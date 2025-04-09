document.addEventListener('DOMContentLoaded', function() {
  // Elementos do player
  const audio = new Audio();
  const songTitle = document.getElementById('song-title');
  const songArtist = document.getElementById('song-artist');
  const albumArt = document.getElementById('album-art');
  const progress = document.getElementById('progress');
  const currentTime = document.getElementById('current-time');
  const duration = document.getElementById('duration');
  const playBtn = document.getElementById('play-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const volume = document.getElementById('volume');
  const repeatBtn = document.getElementById('repeat-btn');
  const shuffleBtn = document.getElementById('shuffle-btn');
  
  // Elementos das playlists
  const playlistTabs = document.getElementById('playlist-tabs');
  const songsList = document.getElementById('songs-list');
  const currentPlaylistName = document.getElementById('current-playlist-name');
  const addSongBtn = document.getElementById('add-song-btn');
  const newPlaylistBtn = document.getElementById('new-playlist-btn');
  
  // Modais
  const songModal = document.getElementById('song-modal');
  const playlistModal = document.getElementById('playlist-modal');
  const closeButtons = document.querySelectorAll('.close');
  const songForm = document.getElementById('song-form');
  const playlistForm = document.getElementById('playlist-form');
  
   // Estado do player
   let playerState = {
    currentPlaylistIndex: 0,
    currentSongIndex: -1,
    isPlaying: false,
    isShuffled: false,
    repeatMode: 'none',
    playlists: []
};
  
 // Variáveis do IndexedDB
 let db;
 const DB_NAME = 'MusicPlayerDB';
 const DB_VERSION = 1;
 const PLAYLIST_STORE = 'playlists';
 const SONG_STORE = 'songs';
 
 // Inicializa o IndexedDB
 function initDB() {
     return new Promise((resolve, reject) => {
         const request = indexedDB.open(DB_NAME, DB_VERSION);
         
         request.onerror = (event) => {
             console.error('Erro ao abrir o banco de dados:', event.target.error);
             reject('Erro ao abrir o banco de dados');
         };
         
         request.onsuccess = (event) => {
             db = event.target.result;
             resolve();
         };
         
         request.onupgradeneeded = (event) => {
             const db = event.target.result;
             
             // Cria a store de playlists
             if (!db.objectStoreNames.contains(PLAYLIST_STORE)) {
                 const playlistStore = db.createObjectStore(PLAYLIST_STORE, {
                     keyPath: 'id',
                     autoIncrement: true
                 });
                 playlistStore.createIndex('name', 'name', { unique: false });
             }
             
             // Cria a store de músicas
             if (!db.objectStoreNames.contains(SONG_STORE)) {
                 const songStore = db.createObjectStore(SONG_STORE, {
                     keyPath: 'id',
                     autoIncrement: true
                 });
                 songStore.createIndex('playlistId', 'playlistId', { unique: false });
             }
         };
     });
 }
 
 // Carrega todas as playlists do IndexedDB
 function loadPlaylists() {
     return new Promise((resolve, reject) => {
         const transaction = db.transaction(PLAYLIST_STORE, 'readonly');
         const store = transaction.objectStore(PLAYLIST_STORE);
         const request = store.getAll();
         
         request.onerror = (event) => {
             console.error('Erro ao carregar playlists:', event.target.error);
             reject(event.target.error);
         };
         
         request.onsuccess = (event) => {
             const playlists = event.target.result;
             playerState.playlists = playlists.map(playlist => ({
                 id: playlist.id,
                 name: playlist.name,
                 songs: [] // As músicas serão carregadas separadamente
             }));
             
             // Carrega as músicas para cada playlist
             const loadSongsPromises = playerState.playlists.map(playlist => 
                 loadSongsForPlaylist(playlist.id)
             );
             
             Promise.all(loadSongsPromises)
                 .then(() => resolve())
                 .catch(error => reject(error));
         };
     });
 }
 
 // Carrega as músicas para uma playlist específica
 function loadSongsForPlaylist(playlistId) {
     return new Promise((resolve, reject) => {
         const transaction = db.transaction(SONG_STORE, 'readonly');
         const store = transaction.objectStore(SONG_STORE);
         const index = store.index('playlistId');
         const request = index.getAll(playlistId);
         
         request.onerror = (event) => {
             console.error('Erro ao carregar músicas:', event.target.error);
             reject(event.target.error);
         };
         
         request.onsuccess = (event) => {
             const songs = event.target.result;
             const playlist = playerState.playlists.find(p => p.id === playlistId);
             
             if (playlist) {
                 playlist.songs = songs.map(song => ({
                     id: song.id,
                     title: song.title,
                     artist: song.artist,
                     url: song.url,
                     albumArt: song.albumArt
                 }));
             }
             
             resolve();
         };
     });
 }
 
 // Adiciona uma nova playlist ao IndexedDB
 function addPlaylistToDB(playlist) {
     return new Promise((resolve, reject) => {
         const transaction = db.transaction(PLAYLIST_STORE, 'readwrite');
         const store = transaction.objectStore(PLAYLIST_STORE);
         const request = store.add(playlist);
         
         request.onerror = (event) => {
             console.error('Erro ao adicionar playlist:', event.target.error);
             reject(event.target.error);
         };
         
         request.onsuccess = (event) => {
             resolve(event.target.result); // Retorna o ID da nova playlist
         };
     });
 }
 
 // Adiciona uma nova música ao IndexedDB
 function addSongToDB(song) {
     return new Promise((resolve, reject) => {
         const transaction = db.transaction(SONG_STORE, 'readwrite');
         const store = transaction.objectStore(SONG_STORE);
         const request = store.add(song);
         
         request.onerror = (event) => {
             console.error('Erro ao adicionar música:', event.target.error);
             reject(event.target.error);
         };
         
         request.onsuccess = (event) => {
             resolve(event.target.result); // Retorna o ID da nova música
         };
     });
 }
 
 // Remove uma música do IndexedDB
 function removeSongFromDB(songId) {
     return new Promise((resolve, reject) => {
         const transaction = db.transaction(SONG_STORE, 'readwrite');
         const store = transaction.objectStore(SONG_STORE);
         const request = store.delete(songId);
         
         request.onerror = (event) => {
             console.error('Erro ao remover música:', event.target.error);
             reject(event.target.error);
         };
         
         request.onsuccess = (event) => {
             resolve();
         };
     });
 }

  // Inicializa o player
  async function initPlayer() {
    try {
        // Inicializa o IndexedDB
        await initDB();
        
        // Carrega as playlists e músicas
        await loadPlaylists();
        
        // Se não houver playlists, cria uma padrão
        if (playerState.playlists.length === 0) {
            const defaultPlaylist = {
                name: 'Minha Playlist',
                songs: []
            };
            
            const playlistId = await addPlaylistToDB(defaultPlaylist);
            defaultPlaylist.id = playlistId;
            playerState.playlists.push(defaultPlaylist);
        }
        
        // Configura eventos
        setupEventListeners();
        
        // Atualiza a UI
        updatePlaylistsUI();
        updateSongsUI();
        updatePlayerUI();
        
        // Configura o volume inicial
        audio.volume = volume.value;
    } catch (error) {
        console.error('Erro ao inicializar o player:', error);
        alert('Ocorreu um erro ao carregar o player. Por favor, recarregue a página.');
    }
}
  
  // Configura os event listeners
  function setupEventListeners() {
      // Controles do player
      playBtn.addEventListener('click', togglePlay);
      prevBtn.addEventListener('click', playPreviousSong);
      nextBtn.addEventListener('click', playNextSong);
      progress.addEventListener('input', setProgress);
      volume.addEventListener('input', setVolume);
      repeatBtn.addEventListener('click', toggleRepeatMode);
      shuffleBtn.addEventListener('click', toggleShuffle);
      
      // Eventos do áudio
      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('ended', handleSongEnd);
      audio.addEventListener('loadedmetadata', updateDuration);
      
      // Playlists e músicas
      addSongBtn.addEventListener('click', () => songModal.style.display = 'block');
      newPlaylistBtn.addEventListener('click', () => playlistModal.style.display = 'block');
      
      // Fechar modais
      closeButtons.forEach(btn => {
          btn.addEventListener('click', () => {
              songModal.style.display = 'none';
              playlistModal.style.display = 'none';
          });
      });
      
      // Formulários
      songForm.addEventListener('submit', addNewSong);
      playlistForm.addEventListener('submit', addNewPlaylist);
      
      // Clicar fora do modal para fechar
      window.addEventListener('click', (e) => {
          if (e.target === songModal) songModal.style.display = 'none';
          if (e.target === playlistModal) playlistModal.style.display = 'none';
      });
  }
  
  // Atualiza a UI das playlists
  function updatePlaylistsUI() {
      playlistTabs.innerHTML = '';
      
      playerState.playlists.forEach((playlist, index) => {
          const li = document.createElement('li');
          li.textContent = playlist.name;
          if (index === playerState.currentPlaylistIndex) {
              li.classList.add('active');
          }
          
          li.addEventListener('click', () => {
              playerState.currentPlaylistIndex = index;
              playerState.currentSongIndex = -1;
              updatePlaylistsUI();
              updateSongsUI();
              updatePlayerUI();
              savePlayerState();
          });
          
          playlistTabs.appendChild(li);
      });
      
      if (playerState.playlists.length > 0) {
          currentPlaylistName.textContent = playerState.playlists[playerState.currentPlaylistIndex].name;
      } else {
          currentPlaylistName.textContent = 'Nenhuma playlist';
      }
  }
  
  // Atualiza a UI das músicas
  function updateSongsUI() {
      songsList.innerHTML = '';
      
      if (playerState.playlists.length === 0) return;
      
      const currentPlaylist = playerState.playlists[playerState.currentPlaylistIndex];
      
      currentPlaylist.songs.forEach((song, index) => {
          const li = document.createElement('li');
          
          // Destaca a música atual
          if (index === playerState.currentSongIndex && playerState.currentPlaylistIndex === playerState.currentPlaylistIndex) {
              li.classList.add('playing');
          }
          
          li.innerHTML = `
              <span>${song.title} - ${song.artist || 'Artista Desconhecido'}</span>
              <div class="song-actions">
                  <button class="remove-song" data-index="${index}"><i class="fas fa-trash"></i></button>
              </div>
          `;
          
          li.addEventListener('click', () => {
              playSong(index);
          });
          
          // Adiciona evento para remover música
          const removeBtn = li.querySelector('.remove-song');
          removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              removeSong(index);
          });
          
          songsList.appendChild(li);
      });
  }
  
  // Atualiza a UI do player
  function updatePlayerUI() {
      if (playerState.currentSongIndex === -1 || playerState.playlists.length === 0) {
          songTitle.textContent = 'Nenhuma música selecionada';
          songArtist.textContent = '';
          albumArt.src = 'https://via.placeholder.com/300';
          return;
      }
      
      const currentPlaylist = playerState.playlists[playerState.currentPlaylistIndex];
      const currentSong = currentPlaylist.songs[playerState.currentSongIndex];
      
      songTitle.textContent = currentSong.title;
      songArtist.textContent = currentSong.artist || 'Artista Desconhecido';
      
      // Usa uma imagem padrão se não houver capa
      albumArt.src = currentSong.albumArt || 'https://via.placeholder.com/300';
      
      // Atualiza o botão de play/pause
      if (playerState.isPlaying) {
          playBtn.innerHTML = '<i class="fas fa-pause"></i>';
      } else {
          playBtn.innerHTML = '<i class="fas fa-play"></i>';
      }
      
      // Atualiza o botão de repetição
      switch (playerState.repeatMode) {
          case 'none':
              repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
              repeatBtn.style.color = '';
              break;
          case 'one':
              repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
              repeatBtn.style.color = 'var(--primary-color)';
              break;
          case 'all':
              repeatBtn.innerHTML = '<i class="fas fa-infinity"></i>';
              repeatBtn.style.color = 'var(--primary-color)';
              break;
      }
      
      // Atualiza o botão de shuffle
      if (playerState.isShuffled) {
          shuffleBtn.style.color = 'var(--primary-color)';
      } else {
          shuffleBtn.style.color = '';
      }
  }
  
  // Toca uma música específica
  function playSong(index) {
      if (playerState.playlists.length === 0) return;
      
      const currentPlaylist = playerState.playlists[playerState.currentPlaylistIndex];
      
      if (index < 0 || index >= currentPlaylist.songs.length) return;
      
      playerState.currentSongIndex = index;
      const song = currentPlaylist.songs[index];
      
      audio.src = song.url;
      audio.play()
          .then(() => {
              playerState.isPlaying = true;
              updatePlayerUI();
              updateSongsUI();
              savePlayerState();
          })
          .catch(error => {
              console.error('Erro ao reproduzir música:', error);
          });
  }
  
  // Alterna entre play e pause
  function togglePlay() {
      if (playerState.currentSongIndex === -1) {
          // Se não houver música selecionada, toca a primeira da playlist
          if (playerState.playlists.length > 0 && 
              playerState.playlists[playerState.currentPlaylistIndex].songs.length > 0) {
              playSong(0);
          }
          return;
      }
      
      if (playerState.isPlaying) {
          audio.pause();
      } else {
          audio.play();
      }
      
      playerState.isPlaying = !playerState.isPlaying;
      updatePlayerUI();
      savePlayerState();
  }
  
  // Toca a música anterior
  function playPreviousSong() {
      if (playerState.playlists.length === 0) return;
      
      const currentPlaylist = playerState.playlists[playerState.currentPlaylistIndex];
      
      if (currentPlaylist.songs.length === 0) return;
      
      let newIndex = playerState.currentSongIndex - 1;
      
      if (newIndex < 0) {
          newIndex = currentPlaylist.songs.length - 1;
      }
      
      playSong(newIndex);
  }
  
  // Toca a próxima música
  function playNextSong() {
      if (playerState.playlists.length === 0) return;
      
      const currentPlaylist = playerState.playlists[playerState.currentPlaylistIndex];
      
      if (currentPlaylist.songs.length === 0) return;
      
      let newIndex = playerState.currentSongIndex + 1;
      
      if (newIndex >= currentPlaylist.songs.length) {
          newIndex = 0;
      }
      
      playSong(newIndex);
  }
  
  // Manipula o fim da música atual
  function handleSongEnd() {
      switch (playerState.repeatMode) {
          case 'one':
              // Repete a mesma música
              audio.currentTime = 0;
              audio.play();
              break;
          case 'all':
              // Vai para a próxima música ou volta para a primeira
              playNextSong();
              break;
          default:
              // Para a reprodução
              playerState.isPlaying = false;
              updatePlayerUI();
              savePlayerState();
              break;
      }
  }
  
  // Atualiza a barra de progresso
  function updateProgress() {
      const { currentTime: time, duration: dur } = audio;
      
      if (isNaN(dur)) return;
      
      progress.value = time;
      progress.max = dur;
      
      // Atualiza os tempos exibidos
      currentTime.textContent = formatTime(time);
      duration.textContent = formatTime(dur);
  }
  
  // Atualiza a duração total quando o áudio é carregado
  function updateDuration() {
      duration.textContent = formatTime(audio.duration);
      progress.max = audio.duration;
  }
  
  // Define a posição de reprodução com base na barra de progresso
  function setProgress() {
      audio.currentTime = progress.value;
  }
  
  // Define o volume
  function setVolume() {
      audio.volume = volume.value;
  }
  
  // Alterna o modo de repetição
  function toggleRepeatMode() {
      const modes = ['none', 'one', 'all'];
      const currentIndex = modes.indexOf(playerState.repeatMode);
      playerState.repeatMode = modes[(currentIndex + 1) % modes.length];
      updatePlayerUI();
      savePlayerState();
  }
  
  // Alterna o modo shuffle
  function toggleShuffle() {
      playerState.isShuffled = !playerState.isShuffled;
      updatePlayerUI();
      savePlayerState();
  }
  
  // Adiciona uma nova música
  async function addNewSong(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('song-file');
    const songName = document.getElementById('song-name').value;
    const songArtistInput = document.getElementById('song-artist-input').value;
    const coverInput = document.getElementById('song-cover');
    
    if (!fileInput.files[0]) {
        alert('Por favor, selecione um arquivo de música.');
        return;
    }
    
    try {
        const file = fileInput.files[0];
        const songUrl = await readFileAsDataURL(file);
        
        let coverUrl = '';
        if (coverInput.files[0]) {
            coverUrl = await readFileAsDataURL(coverInput.files[0]);
        }
        
        const currentPlaylist = playerState.playlists[playerState.currentPlaylistIndex];
        
        const newSong = {
            playlistId: currentPlaylist.id,
            title: songName,
            artist: songArtistInput,
            url: songUrl,
            albumArt: coverUrl
        };
        
        // Adiciona a música ao IndexedDB
        const songId = await addSongToDB(newSong);
        newSong.id = songId;
        
        // Adiciona à playlist atual
        currentPlaylist.songs.push(newSong);
        
        // Se for a primeira música, toca automaticamente
        if (currentPlaylist.songs.length === 1) {
            playSong(0);
        }
        
        // Atualiza a UI
        updateSongsUI();
        updatePlayerUI();
        
        // Fecha o modal e limpa o formulário
        songModal.style.display = 'none';
        songForm.reset();
    } catch (error) {
        console.error('Erro ao adicionar música:', error);
        alert('Ocorreu um erro ao adicionar a música. Por favor, tente novamente.');
    }
}

// Lê um arquivo como Data URL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

// Adiciona uma nova playlist
async function addNewPlaylist(e) {
    e.preventDefault();
    
    const playlistName = document.getElementById('playlist-name').value;
    
    if (!playlistName.trim()) {
        alert('Por favor, digite um nome para a playlist.');
        return;
    }
    
    try {
        const newPlaylist = {
            name: playlistName,
            songs: []
        };
        
        // Adiciona ao IndexedDB
        const playlistId = await addPlaylistToDB(newPlaylist);
        newPlaylist.id = playlistId;
        
        // Atualiza o estado do player
        playerState.playlists.push(newPlaylist);
        playerState.currentPlaylistIndex = playerState.playlists.length - 1;
        playerState.currentSongIndex = -1;
        
        // Atualiza a UI
        updatePlaylistsUI();
        updateSongsUI();
        updatePlayerUI();
        
        // Fecha o modal e limpa o formulário
        playlistModal.style.display = 'none';
        playlistForm.reset();
    } catch (error) {
        console.error('Erro ao adicionar playlist:', error);
        alert('Ocorreu um erro ao criar a playlist. Por favor, tente novamente.');
    }
}

// Remove uma música da playlist atual
async function removeSong(index) {
    if (playerState.playlists.length === 0) return;
    
    const currentPlaylist = playerState.playlists[playerState.currentPlaylistIndex];
    
    if (index < 0 || index >= currentPlaylist.songs.length) return;
    
    try {
        const songToRemove = currentPlaylist.songs[index];
        
        // Remove do IndexedDB
        await removeSongFromDB(songToRemove.id);
        
        // Se a música que está tocando for removida, para a reprodução
        if (index === playerState.currentSongIndex) {
            audio.pause();
            playerState.isPlaying = false;
            playerState.currentSongIndex = -1;
        } else if (index < playerState.currentSongIndex) {
            // Ajusta o índice da música atual se necessário
            playerState.currentSongIndex--;
        }
        
        // Remove da playlist local
        currentPlaylist.songs.splice(index, 1);
        
        // Atualiza a UI
        updateSongsUI();
        updatePlayerUI();
    } catch (error) {
        console.error('Erro ao remover música:', error);
        alert('Ocorreu um erro ao remover a música. Por favor, tente novamente.');
    }
}
  
  // Formata o tempo em minutos:segundos
  function formatTime(seconds) {
      if (isNaN(seconds)) return '0:00';
      
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  
  // Salva o estado do player no localStorage
  function savePlayerState() {
      localStorage.setItem('musicPlayerData', JSON.stringify(playerState));
  }
  
  // Inicializa o player quando a página carrega
  initPlayer();
});