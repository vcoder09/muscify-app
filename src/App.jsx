import { useState, useEffect, useRef } from "react";
import { searchByTab, getTrendingMusic } from "./api/youtube";
import "./App.css";

function App() {
   const [query, setQuery] = useState("");
   const [songs, setSongs] = useState([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");

   const [selectedSong, setSelectedSong] = useState(null);
   const [isPlaying, setIsPlaying] = useState(false);
   const [currentTime, setCurrentTime] = useState(0);
   const [duration, setDuration] = useState(0);
   const [volume, setVolume] = useState(70);

   const playerRef = useRef(null);
   const playerContainerRef = useRef(null);
   const [activeTab, setActiveTab] = useState("All");

   const tabs = ["All", "Songs", "Videos", "Albums", "Artists"];

   const handleSearch = async e => {
      e.preventDefault();

      if (!query.trim()) return;

      try {
         setLoading(true);
         setError("");
         setSongs([]);

         const results = await searchByTab(query, activeTab);

         setSongs(results);

         if (results.length === 0) {
            setError(`No results found in ${activeTab}!`);
         }
      } catch (error) {
         setError(error.message);
      } finally {
         setLoading(false);
      }
   };

   const handleTabChange = async tab => {
      setActiveTab(tab);

      if (!query.trim()) return;

      try {
         setLoading(true);
         setError("");
         setSongs([]);

         const results = await searchByTab(query, tab);

         setSongs(results);

         if (results.length === 0) {
            setError(`No results found in ${tab}!`);
         }
      } catch (error) {
         setError(error.message);
      } finally {
         setLoading(false);
      }
   };

   // Load YouTube IFrame API
   useEffect(() => {
      if (window.YT?.Player) return;

      const existingScript = document.querySelector(
         'script[src="https://www.youtube.com/iframe_api"]'
      );

      if (existingScript) return;

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
   }, []);

   // Initialize player
   useEffect(() => {
      if (!selectedSong) return;

      let cancelled = false;
      let player;

      const initializePlayer = () => {
         if (cancelled || !window.YT?.Player) return;

         player = new window.YT.Player(playerContainerRef.current, {
            width: "100%",
            height: "200",
            videoId: selectedSong.id.videoId,
            playerVars: {
               autoplay: 1,
               playsinline: 1
            },
            events: {
               onReady: event => {
                  playerRef.current = event.target;
                  event.target.setVolume(volume);
                  setDuration(event.target.getDuration());
                  setIsPlaying(event.target.getPlayerState() === 1);
               },
               onStateChange: event => {
                  setIsPlaying(event.data === 1);

                  if (event.data === 1 || event.data === 3) {
                     setDuration(event.target.getDuration());
                  }
               },
               onError: () => {
                  setError("This video cannot be played. Try another song.");
               }
            }
         });
      };

      const waitForAPI = () => {
         if (cancelled) return;

         if (window.YT?.Player) {
            initializePlayer();
         } else {
            setTimeout(waitForAPI, 200);
         }
      };

      waitForAPI();

      return () => {
         cancelled = true;
         player?.destroy();
         playerRef.current = null;
      };
   }, [selectedSong]);

   // Update progress
   useEffect(() => {
      const timer = setInterval(() => {
         const player = playerRef.current;

         if (player?.getCurrentTime && player?.getDuration) {
            setCurrentTime(player.getCurrentTime());
            setDuration(player.getDuration());
         }
      }, 500);

      return () => clearInterval(timer);
   }, []);

   // Load Trending Songs when app opens
   useEffect(() => {
      const loadTrending = async () => {
         try {
            setLoading(true);
            setError("");

            const results = await getTrendingMusic();

            setSongs(results);

            if (results.length === 0) {
               setError("No trending songs found!");
            }
         } catch (error) {
            console.error("Trending Error:", error);
            setError(error.message);
         } finally {
            setLoading(false);
         }
      };

      loadTrending();
   }, []);

   const togglePlay = () => {
      const player = playerRef.current;
      if (!player) return;

      if (player.getPlayerState() === 1) {
         player.pauseVideo();
      } else {
         player.playVideo();
      }
   };

   const playNext = () => {
      const index = songs.findIndex(
         song => song.id.videoId === selectedSong?.id.videoId
      );

      if (index >= 0 && index < songs.length - 1) {
         setSelectedSong(songs[index + 1]);
      }
   };

   const playPrevious = () => {
      const index = songs.findIndex(
         song => song.id.videoId === selectedSong?.id.videoId
      );

      if (index > 0) {
         setSelectedSong(songs[index - 1]);
      }
   };

   const formatTime = time => {
      if (!Number.isFinite(time)) return "0:00";

      const min = Math.floor(time / 60);
      const sec = Math.floor(time % 60);

      return `${min}:${String(sec).padStart(2, "0")}`;
   };

   return (
      <main className="app">
         <div className="top-content">
            <h1>Muscify.</h1>
            <p className="author-name">By Vaibhav Sanas</p>
            <p>Discover your favourite music</p>
         </div>

         <form onSubmit={handleSearch} className="search">
            <input
               type="search"
               placeholder="Search songs, artists..."
               value={query}
               onChange={e => setQuery(e.target.value)}
            />

            <button disabled={loading}>Search</button>
         </form>
         {/* Search Categories */}

         <div className="search-tabs">
            {tabs.map(tab => (
               <button
                  key={tab}
                  type="button"
                  className={`tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => handleTabChange(tab)}
               >
                  {tab}
               </button>
            ))}
         </div>

         {error && <p className="error">{error}</p>}
         <h2 className="section-title">
            {query.trim()
               ? `${activeTab === "All" ? "Search Results" : activeTab}`
               : "Trending Songs"}
         </h2>
         {loading && <p className="loading-text">Loading music...</p>}
         <section className="songs">
            {songs.map(song => (
               <button
                  className="song"
                  key={
                     song.id.videoId || song.id.playlistId || song.id.channelId
                  }
                  onClick={() => {
                     if (song.id.videoId) {
                        setSelectedSong(song);
                     }
                  }}
                  disabled={!song.id.videoId}
               >
                  <img
                     src={song.snippet.thumbnails.high?.url}
                     alt={song.snippet.title}
                  />

                  <div className="song-info">
                     <h3>{song.snippet.title}</h3>
                     <p>{song.snippet.channelTitle}</p>
                  </div>
               </button>
            ))}
         </section>

         {/* Hidden YouTube player */}
         {selectedSong && (
            <div className="youtube-hidden">
               <div ref={playerContainerRef} />
            </div>
         )}

         {/* Bottom Music Player */}
         {selectedSong && (
            <div
               className="music-player"
               style={{
                  "--player-bg": `url("${
                     selectedSong?.snippet?.thumbnails?.maxres?.url ||
                     selectedSong?.snippet?.thumbnails?.high?.url ||
                     selectedSong?.snippet?.thumbnails?.medium?.url ||
                     ""
                  }")`
               }}
            >
               <div className="player-song">
                  <img
                     src={selectedSong.snippet.thumbnails.medium?.url}
                     alt=""
                  />
                  <div>
                     <h4>{selectedSong.snippet.title}</h4>
                     <p>{selectedSong.snippet.channelTitle}</p>
                  </div>
               </div>

               <div className="player-controls">
                  <div className="control-buttons">
                     <button onClick={playPrevious}>⏮</button>

                     <button className="play-btn" onClick={togglePlay}>
                        {isPlaying ? "❚❚" : "▶"}
                     </button>

                     <button onClick={playNext}>⏭</button>
                  </div>

                  <div className="progress">
                     <span>{formatTime(currentTime)}</span>

                     <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={e => {
                           const time = Number(e.target.value);
                           playerRef.current?.seekTo(time, true);
                           setCurrentTime(time);
                        }}
                        style={{
                           "--progress": `${
                              duration ? (currentTime / duration) * 100 : 0
                           }%`
                        }}
                     />

                     <span>{formatTime(duration)}</span>
                  </div>
               </div>

               <div className="volume-control">
                  <span>🔊</span>
                  <input
                     type="range"
                     min="0"
                     max="100"
                     value={volume}
                     onChange={e => {
                        const value = Number(e.target.value);
                        setVolume(value);
                        playerRef.current?.setVolume(value);
                     }}
                     style={{
                        "--volume": `${volume}%`
                     }}
                  />
               </div>
            </div>
         )}
      </main>
   );
}

export default App;
