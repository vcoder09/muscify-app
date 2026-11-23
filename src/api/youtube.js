const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL = "https://www.googleapis.com/youtube/v3";

// Cache duration
const SEARCH_CACHE_TIME = 30 * 60 * 1000; // 30 minutes
const TRENDING_CACHE_TIME = 60 * 60 * 1000; // 1 hour

// API caching system
const fetchWithCache = async (url, cacheTime = SEARCH_CACHE_TIME) => {
   const cacheKey = `musify_cache_v1_${url}`;

   // Check existing cache
   try {
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
         const { data, timestamp } = JSON.parse(cached);

         if (Date.now() - timestamp < cacheTime) {
            console.log("🟢 Cache Hit");
            return data;
         }

         sessionStorage.removeItem(cacheKey);
      }
   } catch (error) {
      console.warn("Cache read error:", error);
   }

   // Fetch fresh data
   console.log("🔵 YouTube API Request");

   const response = await fetch(url);
   const data = await response.json();

   if (!response.ok) {
      throw new Error(data.error?.message || "YouTube API request failed");
   }

   // Save successful response
   try {
      sessionStorage.setItem(
         cacheKey,
         JSON.stringify({
            data,
            timestamp: Date.now()
         })
      );
   } catch (error) {
      console.warn("Cache storage full or unavailable:", error);
   }

   return data;
};

const unwantedWords =
   /\b(tutorial|how to|coding|programming|lecture|course|lesson|reaction|review|podcast|interview|shorts|short|status|vlog|gameplay|explained|web development)\b|#shorts/i;

// Convert ISO duration into seconds
const getDurationInSeconds = (duration = "") => {
   const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

   if (!match) return 0;

   return (
      Number(match[1] || 0) * 3600 +
      Number(match[2] || 0) * 60 +
      Number(match[3] || 0)
   );
};

// Get Trending Music (India)
export const getTrendingMusic = async () => {
   if (!API_KEY) {
      throw new Error("YouTube API key is missing!");
   }

   const searchParams = new URLSearchParams({
      part: "snippet",
      q: "Hindi Bollywood hit songs official music video",
      type: "video",
      videoCategoryId: "10",
      videoEmbeddable: "true",
      regionCode: "IN",
      relevanceLanguage: "hi",
      order: "viewCount",
      maxResults: "50",
      key: API_KEY
   });

   const searchUrl = `${BASE_URL}/search?${searchParams}`;

   // Trending search cached for 1 hour
   const searchData = await fetchWithCache(searchUrl, TRENDING_CACHE_TIME);

   const videoIds = (searchData.items || [])
      .map(item => item.id.videoId)
      .filter(Boolean);

   if (!videoIds.length) return [];

   const detailsParams = new URLSearchParams({
      part: "snippet,contentDetails,statistics,status",
      id: videoIds.join(","),
      key: API_KEY
   });

   const detailsUrl = `${BASE_URL}/videos?${detailsParams}`;

   const detailsData = await fetchWithCache(detailsUrl, TRENDING_CACHE_TIME);

   const unwanted =
      /\b(bhajan|devotional|aarti|mantra|tutorial|shorts|status|reaction|cover song|karaoke|remix tutorial)\b/i;

   return (detailsData.items || [])
      .filter(video => {
         const duration = getDurationInSeconds(video.contentDetails?.duration);

         return (
            video.snippet.categoryId === "10" &&
            duration >= 60 &&
            !unwanted.test(video.snippet.title) &&
            video.status?.embeddable === true
         );
      })
      .sort((a, b) => {
         return (
            Number(b.statistics?.viewCount || 0) -
            Number(a.statistics?.viewCount || 0)
         );
      })
      .map(video => ({
         id: { videoId: video.id },
         snippet: video.snippet,
         contentDetails: video.contentDetails,
         statistics: video.statistics
      }));
};

// Search videos
const searchVideos = async query => {
   const params = new URLSearchParams({
      part: "snippet",
      q: `${query} music`,
      type: "video",
      videoCategoryId: "10",
      videoEmbeddable: "true",
      maxResults: "50",
      key: API_KEY
   });

   const searchUrl = `${BASE_URL}/search?${params}`;

   const data = await fetchWithCache(searchUrl);

   const ids = data.items?.map(item => item.id.videoId).filter(Boolean);

   if (!ids?.length) return [];

   const detailsParams = new URLSearchParams({
      part: "snippet,contentDetails,statistics,status",
      id: ids.join(","),
      key: API_KEY
   });

   const detailsUrl = `${BASE_URL}/videos?${detailsParams}`;

   const detailsData = await fetchWithCache(detailsUrl);

   return (detailsData.items || [])
      .filter(video => {
         const title = video.snippet.title;
         const duration = getDurationInSeconds(video.contentDetails.duration);

         return (
            video.snippet.categoryId === "10" &&
            !unwantedWords.test(title) &&
            duration > 180 &&
            video.status.embeddable
         );
      })
      .map(video => ({
         id: { videoId: video.id },
         snippet: video.snippet,
         contentDetails: video.contentDetails,
         statistics: video.statistics
      }));
};

// Search playlists (Albums)
const searchAlbums = async query => {
   const params = new URLSearchParams({
      part: "snippet",
      q: `${query} album`,
      type: "playlist",
      maxResults: "20",
      key: API_KEY
   });

   const url = `${BASE_URL}/search?${params}`;

   const data = await fetchWithCache(url);

   return (data.items || []).map(item => ({
      id: item.id,
      snippet: item.snippet
   }));
};

// Search artists (Channels)
const searchArtists = async query => {
   const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "channel",
      maxResults: "20",
      key: API_KEY
   });

   const url = `${BASE_URL}/search?${params}`;

   const data = await fetchWithCache(url);

   return (data.items || []).map(item => ({
      id: item.id,
      snippet: item.snippet
   }));
};

// Main search function
export const searchByTab = async (query, tab = "All") => {
   if (!query.trim()) return [];

   if (!API_KEY) {
      throw new Error("YouTube API key is missing!");
   }

   try {
      switch (tab) {
         case "Songs":
            return await searchVideos(`${query} official audio`);

         case "Videos":
            return await searchVideos(`${query} official music video`);

         case "Albums":
            return await searchAlbums(query);

         case "Artists":
            return await searchArtists(query);

         case "All":
         default:
            return await searchVideos(query);
      }
   } catch (error) {
      console.error("Music Search Error:", error);
      throw error;
   }
};

// Backward compatibility
export const searchMusic = query => searchByTab(query, "Songs");
