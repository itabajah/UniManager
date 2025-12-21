/**
 * @fileoverview Video fetching from external sources (YouTube, Panopto).
 * Handles importing videos from playlists and folders.
 */

'use strict';

// ============================================================================
// CORS PROXY
// ============================================================================

/**
 * Fetches a URL through CORS proxies with fallback.
 * @param {string} url - URL to fetch
 * @returns {Promise<Response>} Fetch response
 * @throws {Error} If all proxies fail
 */
async function fetchWithCorsProxy(url) {
    let lastError = null;
    
    for (const makeProxyUrl of CORS_PROXIES) {
        try {
            const proxyUrl = makeProxyUrl(url);
            const response = await fetch(proxyUrl);
            if (response.ok) {
                return response;
            }
        } catch (e) {
            lastError = e;
        }
    }
    
    throw lastError || new Error('All CORS proxies failed');
}

// ============================================================================
// VIDEO FETCH ENTRY POINT
// ============================================================================

/**
 * Fetches videos from a YouTube playlist or Panopto extracted data.
 */
async function fetchVideosFromSource() {
    const sourceSelect = $('fetch-source-select');
    const urlInput = $('fetch-url-input');
    const statusDiv = $('fetch-status');
    const useOriginalNames = $('fetch-use-original-names')?.checked ?? true;
    
    const source = sourceSelect?.value;
    
    showFetchStatus(statusDiv, 'Processing...');
    
    try {
        let videos = [];
        
        if (source === 'youtube') {
            const url = urlInput?.value?.trim();
            if (!url) {
                showFetchStatus(statusDiv, 'Please enter a YouTube playlist URL.', true);
                return;
            }
            videos = await fetchYouTubePlaylist(url);
        } else if (source === 'panopto') {
            // Use extracted videos from the browser/paste flow
            const extractedVideos = window.panoptoExtractedVideos || [];
            const selectedVideos = extractedVideos.filter(v => v.selected);
            
            if (selectedVideos.length === 0) {
                showFetchStatus(statusDiv, 'No videos selected. Load a folder and extract videos first.', true);
                return;
            }
            
            videos = selectedVideos.map(v => ({
                title: v.title,
                url: v.url
            }));
        }
        
        if (videos.length === 0) {
            throw new Error('No videos found in the playlist/folder.');
        }
        
        addFetchedVideos(videos, useOriginalNames);
        
        showFetchStatus(statusDiv, `Success! Added ${videos.length} videos.`, false);
        
        setTimeout(() => {
            closeModal('fetch-videos-modal');
            if (urlInput) urlInput.value = '';
            $('fetch-panopto-url').value = '';
            window.panoptoExtractedVideos = [];
            if (statusDiv) statusDiv.textContent = '';
        }, ANIMATION_DURATIONS.FETCH_SUCCESS_DELAY);
        
    } catch (err) {
        console.error('Fetch videos error:', err);
        showFetchStatus(statusDiv, 'Error: ' + err.message, true);
    }
}

/**
 * Shows fetch status message.
 * @param {HTMLElement} statusDiv - Status element
 * @param {string} message - Message to show
 * @param {boolean} isError - Whether this is an error
 */
function showFetchStatus(statusDiv, message, isError = false) {
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? 'var(--error-border)' : 'var(--text-tertiary)';
}

/**
 * Adds fetched videos to the current recordings tab.
 * @param {Array<{title: string, url: string}>} videos - Videos to add
 * @param {boolean} useOriginalNames - Whether to use original video titles
 */
function addFetchedVideos(videos, useOriginalNames) {
    const course = getCourse(editingCourseId);
    if (!course) throw new Error('Course not found.');
    
    const tab = course.recordings.tabs.find(t => t.id === window.currentRecordingsTab);
    if (!tab) throw new Error('Tab not found.');
    
    const startCount = tab.items.length;
    const tabSingular = tab.name.replace(/s$/, '');
    
    videos.forEach((video, index) => {
        const name = useOriginalNames && video.title 
            ? video.title 
            : `${tabSingular} ${startCount + index + 1}`;
            
        tab.items.push({
            name,
            videoLink: video.url,
            slideLink: '',
            watched: false
        });
    });
    
    saveData();
    renderRecordingsTabs(course);
    renderRecordingsList(course);
    renderCourses(); // Update course card progress
}

// ============================================================================
// YOUTUBE PLAYLIST FETCHING
// ============================================================================

/**
 * Fetches videos from a YouTube playlist.
 * @param {string} url - YouTube playlist URL
 * @returns {Promise<Array<{title: string, url: string}>>} Array of video objects
 */
async function fetchYouTubePlaylist(url) {
    const playlistId = extractYouTubePlaylistId(url);
    if (!playlistId) {
        throw new Error('Could not extract playlist ID from URL. Make sure it\'s a YouTube playlist URL.');
    }
    
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    
    try {
        const response = await fetchWithCorsProxy(playlistUrl);
        const html = await response.text();
        
        // Try parsing structured data first
        let videos = parseYouTubeInitialData(html);
        
        // Fallback to regex extraction
        if (videos.length === 0) {
            videos = extractYouTubeVideoLinks(html);
        }
        
        return videos;
        
    } catch (e) {
        console.error('YouTube fetch error:', e);
        throw new Error('Failed to fetch YouTube playlist. The playlist may be private or the URL is incorrect.');
    }
}

/**
 * Extracts playlist ID from YouTube URL.
 * @param {string} url - YouTube URL
 * @returns {string|null} Playlist ID or null
 */
function extractYouTubePlaylistId(url) {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
}

/**
 * Parses YouTube initial data JSON from HTML.
 * @param {string} html - Page HTML
 * @returns {Array<{title: string, url: string}>} Videos found
 */
function parseYouTubeInitialData(html) {
    const videos = [];
    const dataMatch = html.match(/var ytInitialData = (.+?);<\/script>/);
    
    if (!dataMatch) return videos;
    
    try {
        const data = JSON.parse(dataMatch[1]);
        const contents = data?.contents?.twoColumnBrowseResultsRenderer
            ?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
            ?.contents?.[0]?.itemSectionRenderer?.contents?.[0]
            ?.playlistVideoListRenderer?.contents;
        
        if (contents) {
            contents.forEach(item => {
                const videoRenderer = item.playlistVideoRenderer;
                if (videoRenderer) {
                    const videoId = videoRenderer.videoId;
                    const title = videoRenderer.title?.runs?.[0]?.text || `Video ${videos.length + 1}`;
                    videos.push({
                        title,
                        url: `https://www.youtube.com/watch?v=${videoId}`
                    });
                }
            });
        }
    } catch (e) {
        console.warn('Failed to parse YouTube initial data:', e);
    }
    
    return videos;
}

/**
 * Extracts video links from YouTube HTML using regex.
 * @param {string} html - Page HTML
 * @returns {Array<{title: string, url: string}>} Videos found
 */
function extractYouTubeVideoLinks(html) {
    const videos = [];
    const videoMatches = html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})(?:&amp;|&)list=/g);
    const seenIds = new Set();
    
    for (const match of videoMatches) {
        const videoId = match[1];
        if (!seenIds.has(videoId)) {
            seenIds.add(videoId);
            videos.push({
                title: `Video ${videos.length + 1}`,
                url: `https://www.youtube.com/watch?v=${videoId}`
            });
        }
    }
    
    return videos;
}

// ============================================================================
// PANOPTO FOLDER FETCHING
// ============================================================================

/**
 * Fetches videos from a Panopto folder.
 * @param {string} url - Panopto folder URL
 * @returns {Promise<Array<{title: string, url: string}>>} Array of video objects
 */
async function fetchPanoptoFolder(url) {
    const { folderId, baseDomain } = extractPanoptoInfo(url);
    
    if (!folderId) {
        throw new Error('Could not extract folder ID from URL. Make sure it\'s a Panopto folder URL.');
    }
    if (!baseDomain) {
        throw new Error('Invalid Panopto URL.');
    }
    
    try {
        const response = await fetchWithCorsProxy(url);
        const html = await response.text();
        
        const videos = parsePanoptoVideos(html, baseDomain);
        return videos;
        
    } catch (e) {
        console.error('Panopto fetch error:', e);
        throw new Error('Failed to fetch Panopto folder. The folder may be private or require authentication.');
    }
}

/**
 * Extracts folder ID and domain from Panopto URL.
 * @param {string} url - Panopto URL
 * @returns {{folderId: string|null, baseDomain: string|null}}
 */
function extractPanoptoInfo(url) {
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch {
        decodedUrl = url;
    }
    
    // Try multiple patterns for folder ID
    const patterns = [
        /folderID=["']([a-f0-9-]+)["']/i,
        /folderID=([a-f0-9-]+)/i,
        /folder[/=]([a-f0-9-]+)/i
    ];
    
    let folderId = null;
    for (const pattern of patterns) {
        const match = decodedUrl.match(pattern) || url.match(pattern);
        if (match) {
            folderId = match[1];
            break;
        }
    }
    
    const domainMatch = url.match(/(https:\/\/[^\/]+)/);
    const baseDomain = domainMatch ? domainMatch[1] : null;
    
    return { folderId, baseDomain };
}

/**
 * Parses Panopto videos from HTML.
 * @param {string} html - Page HTML
 * @param {string} baseDomain - Panopto base domain
 * @returns {Array<{title: string, url: string}>} Videos found
 */
function parsePanoptoVideos(html, baseDomain) {
    const videos = [];
    const seenIds = new Set();
    
    // Try multiple extraction methods
    extractPanoptoDeliveryInfo(html, baseDomain, videos, seenIds);
    extractPanoptoHrefLinks(html, baseDomain, videos, seenIds);
    extractPanoptoSessionIds(html, baseDomain, videos, seenIds);
    extractPanoptoJsonData(html, baseDomain, videos, seenIds);
    
    return videos;
}

/**
 * Extracts Panopto videos from DeliveryInfo JSON.
 */
function extractPanoptoDeliveryInfo(html, baseDomain, videos, seenIds) {
    const deliveryMatches = html.matchAll(/DeliveryInfo[^{]*({[^}]+})/g);
    for (const match of deliveryMatches) {
        try {
            const data = JSON.parse(match[1]);
            if (data.SessionId && data.SessionName && !seenIds.has(data.SessionId)) {
                seenIds.add(data.SessionId);
                videos.push({
                    title: data.SessionName,
                    url: `${baseDomain}/Panopto/Pages/Viewer.aspx?id=${data.SessionId}`
                });
            }
        } catch {}
    }
}

/**
 * Extracts Panopto videos from href links.
 */
function extractPanoptoHrefLinks(html, baseDomain, videos, seenIds) {
    const hrefMatches = html.matchAll(/href="[^"]*(?:id=|\/Viewer\.aspx\?id=)([a-f0-9-]{36})[^"]*"[^>]*>([^<]+)/gi);
    for (const match of hrefMatches) {
        const sessionId = match[1];
        const title = match[2].trim();
        
        if (!seenIds.has(sessionId) && title && title.length > 1 && 
            !title.includes('{') && !title.includes('var ')) {
            seenIds.add(sessionId);
            videos.push({
                title,
                url: `${baseDomain}/Panopto/Pages/Viewer.aspx?id=${sessionId}`
            });
        }
    }
}

/**
 * Extracts Panopto videos from generic session ID patterns.
 */
function extractPanoptoSessionIds(html, baseDomain, videos, seenIds) {
    const sessionMatches = html.matchAll(/id[=:][\s"']*([a-f0-9-]{36})[\s"']*[^>]*>([^<]{3,100})/gi);
    for (const match of sessionMatches) {
        const sessionId = match[1];
        const title = match[2].trim();
        
        if (!seenIds.has(sessionId) && title && 
            !title.includes('{') && !title.includes('function')) {
            seenIds.add(sessionId);
            videos.push({
                title,
                url: `${baseDomain}/Panopto/Pages/Viewer.aspx?id=${sessionId}`
            });
        }
    }
}

/**
 * Extracts Panopto videos from JSON data blocks.
 */
function extractPanoptoJsonData(html, baseDomain, videos, seenIds) {
    if (videos.length > 0) return;
    
    const jsonPatterns = [
        /Sessions\s*[=:]\s*(\[[^\]]+\])/s,
        /"sessions"\s*:\s*(\[[^\]]+\])/s,
        /SessionList\s*[=:]\s*(\[[^\]]+\])/s
    ];
    
    for (const pattern of jsonPatterns) {
        const dataMatch = html.match(pattern);
        if (dataMatch) {
            try {
                const sessions = JSON.parse(dataMatch[1]);
                sessions.forEach(session => {
                    const id = session.Id || session.id || session.SessionId;
                    const name = session.Name || session.name || session.SessionName || session.Title;
                    if (id && name && !seenIds.has(id)) {
                        seenIds.add(id);
                        videos.push({
                            title: name,
                            url: `${baseDomain}/Panopto/Pages/Viewer.aspx?id=${id}`
                        });
                    }
                });
                break;
            } catch (e) {
                console.warn('Failed to parse Panopto sessions JSON:', e);
            }
        }
    }
}

// ============================================================================
// PANOPTO HTML FILE PARSING
// ============================================================================

/**
 * Parses a saved Panopto HTML file to extract videos.
 * @param {string} html - HTML content of the saved Panopto page
 * @returns {Array<{title: string, url: string}>} Videos parsed
 */
function parsePanoptoHtmlFile(html) {
    const videos = [];
    const seenIds = new Set();
    
    // Extract base URL from the HTML for constructing video URLs
    const baseMatch = html.match(/href="(https:\/\/[^\/]+)\/Panopto\/Pages\/Viewer\.aspx/);
    const baseUrl = baseMatch ? baseMatch[1] : '';
    
    if (!baseUrl) {
        throw new Error('Could not detect Panopto domain from the HTML file.');
    }
    
    // Primary pattern: Video rows have id=UUID and aria-label="Title"
    // This is the most reliable pattern in Panopto folder pages
    const rowPattern = /<tr\s+id="([a-f0-9-]{36})"[^>]*aria-label="([^"]+)"/gi;
    
    let match;
    while ((match = rowPattern.exec(html)) !== null) {
        const id = match[1];
        const title = decodeHtmlEntities(match[2].trim());
        
        // Skip duplicates and empty titles
        if (id && title && !seenIds.has(id)) {
            seenIds.add(id);
            const url = `${baseUrl}/Panopto/Pages/Viewer.aspx?id=${id}`;
            videos.push({ title, url });
        }
    }
    
    // Fallback: Try to find viewer links directly if no rows found
    if (videos.length === 0) {
        const linkPattern = /href="([^"]*\/Panopto\/Pages\/Viewer\.aspx\?id=([a-f0-9-]{36})[^"]*)"/gi;
        const foundIds = new Map();
        
        while ((match = linkPattern.exec(html)) !== null) {
            const url = match[1];
            const id = match[2];
            if (!foundIds.has(id)) {
                foundIds.set(id, url.startsWith('http') ? url : baseUrl + url);
            }
        }
        
        // Try to find titles in detail-title spans
        let index = 0;
        for (const [id, url] of foundIds) {
            index++;
            // Look for aria-label or detail-title near this ID
            const titlePattern = new RegExp(`id=["']?${id}["']?[^>]*aria-label="([^"]+)"`, 'i');
            const titleMatch = html.match(titlePattern);
            
            const title = titleMatch 
                ? decodeHtmlEntities(titleMatch[1].trim())
                : `Video ${index}`;
            
            if (!seenIds.has(id)) {
                seenIds.add(id);
                videos.push({ title, url });
            }
        }
    }
    
    if (videos.length === 0) {
        throw new Error('No Panopto videos found in the HTML file. Make sure you saved the complete page after scrolling to load all videos.');
    }
    
    return videos;
}

/**
 * Decodes HTML entities in a string.
 * @param {string} str - String with HTML entities
 * @returns {string} Decoded string
 */
function decodeHtmlEntities(str) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
}

// ============================================================================
// FETCH SOURCE TOGGLE
// ============================================================================

/**
 * Toggles between YouTube and Panopto sections in the fetch modal.
 */
function toggleFetchSource() {
    const source = $('fetch-source-select')?.value;
    const youtubeSection = $('fetch-youtube-section');
    const panoptoSection = $('fetch-panopto-section');
    
    if (youtubeSection) {
        youtubeSection.style.display = source === 'youtube' ? 'block' : 'none';
    }
    if (panoptoSection) {
        panoptoSection.style.display = source === 'panopto' ? 'block' : 'none';
    }
}
