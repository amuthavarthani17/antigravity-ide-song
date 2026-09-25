/**
 * ====================================================================
 * SOUNDPULSE - APPLICATION CORE ENGINE
 * Dynamic Cloudinary & Supabase Music Streaming Web Application
 * ====================================================================
 */

// Application State
const state = {
    supabaseClient: null,
    songs: [],
    filteredSongs: [],
    currentSongIndex: -1,
    isPlaying: false,
    isShuffle: false,
    isRepeat: false,
    volume: 0.8,
    isMuted: false,
    previousVolume: 0.8,
    isEditing: false,
    editSongId: null,
    viewMode: 'grid', // 'grid' | 'list'
    realtimeSubscription: null
};

// DOM Element References
const elements = {
    // Navigation & Tabs
    sidebar: document.getElementById('sidebar'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mobileCloseBtn: document.getElementById('mobileCloseBtn'),
    navDiscover: document.getElementById('navDiscover'),
    navSongs: document.getElementById('navSongs'),
    navAdmin: document.getElementById('navAdmin'),
    tabDiscover: document.getElementById('tabDiscover'),
    tabAdmin: document.getElementById('tabAdmin'),
    sidebarSongCount: document.getElementById('sidebarSongCount'),
    dbStatusDot: document.getElementById('dbStatusDot'),
    dbStatusText: document.getElementById('dbStatusText'),

    // Top Header & Search
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnHeaderAdmin: document.getElementById('btnHeaderAdmin'),
    btnConfigGear: document.getElementById('btnConfigGear'),

    // Discover & Song Views
    heroBanner: document.getElementById('heroBanner'),
    heroTitle: document.getElementById('heroTitle'),
    heroArtist: document.getElementById('heroArtist'),
    heroCoverImg: document.getElementById('heroCoverImg'),
    heroVinyl: document.getElementById('heroVinyl'),
    heroPlayBtn: document.getElementById('heroPlayBtn'),
    heroAdminBtn: document.getElementById('heroAdminBtn'),
    songCounterSubtitle: document.getElementById('songCounterSubtitle'),
    btnGridView: document.getElementById('btnGridView'),
    btnListView: document.getElementById('btnListView'),
    songsContainer: document.getElementById('songsContainer'),
    emptyState: document.getElementById('emptyState'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptyDesc: document.getElementById('emptyDesc'),
    btnEmptyAddSong: document.getElementById('btnEmptyAddSong'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    btnErrorSetup: document.getElementById('btnErrorSetup'),
    btnErrorRetry: document.getElementById('btnErrorRetry'),

    // Admin Dashboard
    adminSongForm: document.getElementById('adminSongForm'),
    formSongId: document.getElementById('formSongId'),
    formTitle: document.getElementById('formTitle'),
    formArtist: document.getElementById('formArtist'),
    formAlbum: document.getElementById('formAlbum'),
    formCoverUrl: document.getElementById('formCoverUrl'),
    formCoverPreview: document.getElementById('formCoverPreview'),
    formAudioUrl: document.getElementById('formAudioUrl'),
    btnUseExampleUrl: document.getElementById('btnUseExampleUrl'),
    btnSubmitSong: document.getElementById('btnSubmitSong'),
    submitBtnText: document.getElementById('submitBtnText'),
    adminFormHeading: document.getElementById('adminFormHeading'),
    btnCancelEdit: document.getElementById('btnCancelEdit'),
    adminTableBody: document.getElementById('adminTableBody'),
    adminTableCount: document.getElementById('adminTableCount'),
    btnAdminRefresh: document.getElementById('btnAdminRefresh'),

    // Persistent Bottom Player
    audioEngine: document.getElementById('audioEngine'),
    playerCoverImg: document.getElementById('playerCoverImg'),
    playerTitle: document.getElementById('playerTitle'),
    playerArtist: document.getElementById('playerArtist'),
    playerEqualizer: document.getElementById('playerEqualizer'),
    btnPlayPause: document.getElementById('btnPlayPause'),
    playPauseIcon: document.getElementById('playPauseIcon'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    btnShuffle: document.getElementById('btnShuffle'),
    btnRepeat: document.getElementById('btnRepeat'),
    currentTime: document.getElementById('currentTime'),
    totalDuration: document.getElementById('totalDuration'),
    seekSlider: document.getElementById('seekSlider'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressBuffered: document.getElementById('progressBuffered'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeIcon: document.getElementById('volumeIcon'),
    btnMute: document.getElementById('btnMute'),

    // Modals
    settingsModal: document.getElementById('settingsModal'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),
    btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
    settingsForm: document.getElementById('settingsForm'),
    cfgSupabaseUrl: document.getElementById('cfgSupabaseUrl'),
    cfgSupabaseKey: document.getElementById('cfgSupabaseKey'),
    btnTestSupabaseConnection: document.getElementById('btnTestSupabaseConnection'),
    modalTestStatus: document.getElementById('modalTestStatus'),
    sqlGuideModal: document.getElementById('sqlGuideModal'),
    btnOpenSqlGuide: document.getElementById('btnOpenSqlGuide'),
    btnCloseSqlModal: document.getElementById('btnCloseSqlModal'),
    btnCopySql: document.getElementById('btnCopySql'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
};

// ====================================================================
// INITIALIZATION
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    setupEventListeners();
    setupAudioListeners();
    setupKeyboardShortcuts();
    checkInitialSettings();
});

/**
 * Initialize Supabase Client with credentials from LocalStorage or config.js
 */
function initSupabase() {
    const savedUrl = localStorage.getItem('soundpulse_supabase_url') || 
                     (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.supabaseUrl : '');
    const savedKey = localStorage.getItem('soundpulse_supabase_key') || 
                     (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.supabaseKey : '');

    // Populate settings inputs
    elements.cfgSupabaseUrl.value = savedUrl;
    elements.cfgSupabaseKey.value = savedKey;

    if (savedUrl && savedKey && window.supabase) {
        try {
            state.supabaseClient = window.supabase.createClient(savedUrl, savedKey);
            updateDbStatus('pending', 'Connecting to Supabase...');
            fetchSongs();
            subscribeToRealtime();
        } catch (err) {
            console.error('Failed to initialize Supabase client:', err);
            updateDbStatus('offline', 'Config error');
            showErrorState('Failed to initialize Supabase client. Please check your credentials in settings.');
        }
    } else {
        updateDbStatus('offline', 'Supabase disconnected');
        showErrorState('Supabase URL & Anon Key are required to stream audio dynamically.');
    }
}

/**
 * Subscribe to Supabase Realtime changes on `songs` table
 */
function subscribeToRealtime() {
    if (!state.supabaseClient) return;

    try {
        if (state.realtimeSubscription) {
            state.supabaseClient.removeChannel(state.realtimeSubscription);
        }

        state.realtimeSubscription = state.supabaseClient
            .channel('public:songs')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'songs' },
                (payload) => {
                    console.log('Realtime DB change received:', payload);
                    fetchSongs(false); // refresh without resetting player
                }
            )
            .subscribe();
    } catch (e) {
        console.warn('Realtime subscription not supported or table publication disabled:', e);
    }
}

/**
 * Fetch all songs dynamically from Supabase
 */
async function fetchSongs(showSkeletons = true) {
    if (!state.supabaseClient) {
        showErrorState('Please configure Supabase to fetch songs.');
        return;
    }

    if (showSkeletons) {
        renderSkeletons(4);
    }

    try {
        const { data, error } = await state.supabaseClient
            .from('songs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        state.songs = data || [];
        state.filteredSongs = [...state.songs];

        updateDbStatus('online', 'Connected to Supabase');
        updateSongCounters();
        renderSongs(state.filteredSongs);
        renderAdminTable(state.songs);

        // Update featured banner with first track or currently playing
        updateHeroBanner();

    } catch (error) {
        console.error('Error fetching songs from Supabase:', error);
        updateDbStatus('offline', 'Database error');
        showErrorState(`Supabase error: ${error.message || 'Could not fetch songs table. Make sure the table exists and RLS allows SELECT.'}`);
    }
}

// ====================================================================
// AUDIO PLAYER ENGINE
// ====================================================================

/**
 * Load a song by its index in the current list
 */
function loadSong(index, autoPlay = true) {
    if (index < 0 || index >= state.filteredSongs.length) return;

    state.currentSongIndex = index;
    const song = state.filteredSongs[index];

    // Update Player UI
    elements.playerTitle.textContent = song.title;
    elements.playerArtist.textContent = `${song.artist} • ${song.album || 'Single'}`;
    elements.playerCoverImg.src = song.cover_url || (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.defaultCoverUrl : '');
    elements.playerCoverImg.onerror = () => {
        elements.playerCoverImg.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=160&q=80';
    };

    // Load into HTML5 audio
    elements.audioEngine.src = song.audio_url;
    elements.audioEngine.load();

    // Reset progress
    elements.seekSlider.value = 0;
    elements.progressBarFill.style.width = '0%';
    elements.currentTime.textContent = '0:00';

    if (autoPlay) {
        playTrack();
    }

    highlightActiveSongCard();
    updateHeroBanner();
}

/**
 * Play current audio track
 */
function playTrack() {
    if (state.currentSongIndex === -1 && state.filteredSongs.length > 0) {
        loadSong(0, true);
        return;
    }

    const playPromise = elements.audioEngine.play();
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                state.isPlaying = true;
                updatePlaybackUI(true);
            })
            .catch(error => {
                console.warn('Playback failed or blocked by autoplay policy:', error);
                state.isPlaying = false;
                updatePlaybackUI(false);
                showToast('Playback error: Audio stream failed to play.', 'error');
            });
    }
}

/**
 * Pause current audio track
 */
function pauseTrack() {
    elements.audioEngine.pause();
    state.isPlaying = false;
    updatePlaybackUI(false);
}

/**
 * Toggle Play / Pause
 */
function togglePlayPause() {
    if (state.isPlaying) {
        pauseTrack();
    } else {
        playTrack();
    }
}

/**
 * Next Track
 */
function playNext() {
    if (state.filteredSongs.length === 0) return;

    if (state.isShuffle) {
        const randomIndex = Math.floor(Math.random() * state.filteredSongs.length);
        loadSong(randomIndex, true);
    } else {
        const nextIndex = (state.currentSongIndex + 1) % state.filteredSongs.length;
        loadSong(nextIndex, true);
    }
}

/**
 * Previous Track
 */
function playPrev() {
    if (state.filteredSongs.length === 0) return;

    // If more than 3 seconds in, restart track
    if (elements.audioEngine.currentTime > 3) {
        elements.audioEngine.currentTime = 0;
        return;
    }

    const prevIndex = (state.currentSongIndex - 1 + state.filteredSongs.length) % state.filteredSongs.length;
    loadSong(prevIndex, true);
}

/**
 * Update UI for Play/Pause state
 */
function updatePlaybackUI(isPlaying) {
    if (isPlaying) {
        elements.playPauseIcon.className = 'ri-pause-fill';
        elements.playerEqualizer.classList.remove('hidden');
        elements.heroVinyl.classList.add('spinning');
    } else {
        elements.playPauseIcon.className = 'ri-play-fill';
        elements.playerEqualizer.classList.add('hidden');
        elements.heroVinyl.classList.remove('spinning');
    }
    highlightActiveSongCard();
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// ====================================================================
// AUDIO ENGINE EVENT LISTENERS
// ====================================================================
function setupAudioListeners() {
    const audio = elements.audioEngine;

    // Time update (progress bar)
    audio.addEventListener('timeupdate', () => {
        if (!isNaN(audio.duration) && audio.duration > 0) {
            const progressPercent = (audio.currentTime / audio.duration) * 100;
            elements.seekSlider.value = progressPercent;
            elements.progressBarFill.style.width = `${progressPercent}%`;
            elements.currentTime.textContent = formatTime(audio.currentTime);
        }
    });

    // Duration change / loaded metadata
    audio.addEventListener('loadedmetadata', () => {
        elements.totalDuration.textContent = formatTime(audio.duration);
    });

    // Audio buffering indicator
    audio.addEventListener('progress', () => {
        if (audio.buffered.length > 0 && audio.duration > 0) {
            const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
            const bufferedPercent = (bufferedEnd / audio.duration) * 100;
            elements.progressBuffered.style.width = `${bufferedPercent}%`;
        }
    });

    // Track ended
    audio.addEventListener('ended', () => {
        if (state.isRepeat) {
            audio.currentTime = 0;
            playTrack();
        } else {
            playNext();
        }
    });

    // Audio errors
    audio.addEventListener('error', (e) => {
        console.error('Audio stream playback error:', e);
        state.isPlaying = false;
        updatePlaybackUI(false);
        showToast('Unable to stream this audio URL. Please verify Cloudinary format.', 'error');
    });

    // Seek Slider Input
    elements.seekSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (!isNaN(audio.duration) && audio.duration > 0) {
            const seekTime = (val / 100) * audio.duration;
            audio.currentTime = seekTime;
            elements.progressBarFill.style.width = `${val}%`;
            elements.currentTime.textContent = formatTime(seekTime);
        }
    });

    // Volume Slider Input
    elements.volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
    });

    // Mute Button Toggle
    elements.btnMute.addEventListener('click', toggleMute);

    // Shuffle Toggle
    elements.btnShuffle.addEventListener('click', () => {
        state.isShuffle = !state.isShuffle;
        elements.btnShuffle.classList.toggle('active', state.isShuffle);
        showToast(state.isShuffle ? 'Shuffle turned ON' : 'Shuffle turned OFF', 'info');
    });

    // Repeat Toggle
    elements.btnRepeat.addEventListener('click', () => {
        state.isRepeat = !state.isRepeat;
        elements.btnRepeat.classList.toggle('active', state.isRepeat);
        showToast(state.isRepeat ? 'Repeat track turned ON' : 'Repeat track turned OFF', 'info');
    });

    // Player Buttons
    elements.btnPlayPause.addEventListener('click', togglePlayPause);
    elements.btnNext.addEventListener('click', playNext);
    elements.btnPrev.addEventListener('click', playPrev);
}

function setVolume(value) {
    state.volume = Math.max(0, Math.min(1, value));
    elements.audioEngine.volume = state.volume;
    elements.volumeSlider.value = state.volume;

    if (state.volume === 0) {
        state.isMuted = true;
        elements.volumeIcon.className = 'ri-volume-mute-line';
    } else {
        state.isMuted = false;
        if (state.volume > 0.5) {
            elements.volumeIcon.className = 'ri-volume-up-line';
        } else {
            elements.volumeIcon.className = 'ri-volume-down-line';
        }
    }
}

function toggleMute() {
    if (state.isMuted) {
        setVolume(state.previousVolume || 0.8);
    } else {
        state.previousVolume = state.volume;
        setVolume(0);
    }
}

// ====================================================================
// RENDERING FUNCTIONS (UI)
// ====================================================================

/**
 * Render Song Cards in Discover / All Songs tab
 */
function renderSongs(songs) {
    elements.songsContainer.innerHTML = '';
    elements.errorState.classList.add('hidden');

    if (!songs || songs.length === 0) {
        elements.emptyState.classList.remove('hidden');
        if (elements.searchInput.value.trim() !== '') {
            elements.emptyTitle.textContent = 'No Matches Found';
            elements.emptyDesc.textContent = `No songs matched "${elements.searchInput.value.trim()}". Try another query.`;
        } else {
            elements.emptyTitle.textContent = 'No Songs in Database';
            elements.emptyDesc.textContent = 'Add your first track using the Admin Dashboard to start streaming!';
        }
        return;
    }

    elements.emptyState.classList.add('hidden');

    songs.forEach((song, idx) => {
        const isCurrent = state.currentSongIndex === idx;
        const card = document.createElement('div');
        card.className = `song-card ${isCurrent && state.isPlaying ? 'is-playing' : ''}`;
        card.setAttribute('data-id', song.id);
        card.setAttribute('data-index', idx);

        card.innerHTML = `
            <div class="card-cover-wrapper">
                <img 
                    src="${escapeHtml(song.cover_url)}" 
                    alt="${escapeHtml(song.title)}" 
                    class="card-cover-img" 
                    loading="lazy" 
                    onerror="this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80'"
                >
                <div class="card-play-overlay">
                    <div class="card-play-btn">
                        <i class="${isCurrent && state.isPlaying ? 'ri-pause-fill' : 'ri-play-fill'}"></i>
                    </div>
                </div>
            </div>
            <div class="card-info">
                <div class="card-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</div>
                <div class="card-artist" title="${escapeHtml(song.artist)}">${escapeHtml(song.artist)}</div>
                <div class="card-meta">
                    <span class="card-album-tag">${escapeHtml(song.album || 'Single')}</span>
                    ${isCurrent && state.isPlaying ? `
                        <div class="card-wave-bars">
                            <span class="bar bar-1"></span>
                            <span class="bar bar-2"></span>
                            <span class="bar bar-3"></span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (state.currentSongIndex === idx) {
                togglePlayPause();
            } else {
                loadSong(idx, true);
            }
        });

        elements.songsContainer.appendChild(card);
    });
}

/**
 * Highlight active song card in the list/grid
 */
function highlightActiveSongCard() {
    const cards = elements.songsContainer.querySelectorAll('.song-card');
    cards.forEach((card) => {
        const cardIdx = parseInt(card.getAttribute('data-index'), 10);
        const isCurrent = cardIdx === state.currentSongIndex;
        const icon = card.querySelector('.card-play-btn i');
        const meta = card.querySelector('.card-meta');

        if (isCurrent && state.isPlaying) {
            card.classList.add('is-playing');
            if (icon) icon.className = 'ri-pause-fill';
            
            // Add equalizer wave if not already present
            if (meta && !meta.querySelector('.card-wave-bars')) {
                const wave = document.createElement('div');
                wave.className = 'card-wave-bars';
                wave.innerHTML = `
                    <span class="bar bar-1"></span>
                    <span class="bar bar-2"></span>
                    <span class="bar bar-3"></span>
                `;
                meta.appendChild(wave);
            }
        } else {
            card.classList.remove('is-playing');
            if (icon) icon.className = 'ri-play-fill';
            const wave = meta ? meta.querySelector('.card-wave-bars') : null;
            if (wave) wave.remove();
        }
    });
}

/**
 * Render Admin Songs Table
 */
function renderAdminTable(songs) {
    elements.adminTableBody.innerHTML = '';
    elements.adminTableCount.textContent = songs.length;

    if (!songs || songs.length === 0) {
        elements.adminTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    No tracks in Supabase yet. Use the form to add one.
                </td>
            </tr>
        `;
        return;
    }

    songs.forEach((song) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <img 
                    src="${escapeHtml(song.cover_url)}" 
                    alt="cover" 
                    class="table-thumb" 
                    onerror="this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=120&q=80'"
                >
            </td>
            <td>
                <div class="table-track-title">${escapeHtml(song.title)}</div>
                <div class="table-track-artist">${escapeHtml(song.artist)}</div>
            </td>
            <td>
                <span class="card-album-tag">${escapeHtml(song.album || 'Single')}</span>
            </td>
            <td>
                <a href="${escapeHtml(song.audio_url)}" target="_blank" rel="noopener" class="btn-text-link" title="Open audio stream">
                    <i class="ri-external-link-line"></i> Cloudinary URL
                </a>
            </td>
            <td class="text-right">
                <div class="table-actions">
                    <button class="btn-icon-sm btn-edit-track" title="Edit track" data-id="${song.id}">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="btn-icon-sm btn-icon-danger btn-delete-track" title="Delete track" data-id="${song.id}" data-title="${escapeHtml(song.title)}">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            </td>
        `;

        // Bind Edit
        tr.querySelector('.btn-edit-track').addEventListener('click', () => {
            startEditingSong(song);
        });

        // Bind Delete
        tr.querySelector('.btn-delete-track').addEventListener('click', () => {
            confirmDeleteSong(song.id, song.title);
        });

        elements.adminTableBody.appendChild(tr);
    });
}

/**
 * Render loading skeleton placeholders
 */
function renderSkeletons(count = 4) {
    elements.songsContainer.innerHTML = '';
    elements.emptyState.classList.add('hidden');
    elements.errorState.classList.add('hidden');

    for (let i = 0; i < count; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton-card';
        skel.innerHTML = `
            <div class="skeleton-box skeleton-cover"></div>
            <div class="skeleton-box skeleton-text-lg"></div>
            <div class="skeleton-box skeleton-text-sm"></div>
        `;
        elements.songsContainer.appendChild(skel);
    }
}

/**
 * Update the Top Hero Banner
 */
function updateHeroBanner() {
    const featuredSong = state.currentSongIndex !== -1 
        ? state.filteredSongs[state.currentSongIndex] 
        : (state.songs.length > 0 ? state.songs[0] : null);

    if (featuredSong) {
        elements.heroTitle.textContent = featuredSong.title;
        elements.heroArtist.textContent = `${featuredSong.artist} • ${featuredSong.album || 'Featured Single'}`;
        elements.heroCoverImg.src = featuredSong.cover_url || (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.defaultCoverUrl : '');
        elements.heroPlayBtn.innerHTML = state.isPlaying && state.currentSongIndex !== -1
            ? '<i class="ri-pause-fill"></i> Pause Stream'
            : '<i class="ri-play-fill"></i> Play Featured';
    } else {
        elements.heroTitle.textContent = 'Ready to Stream';
        elements.heroArtist.textContent = 'Add your music library from the Admin Dashboard';
        elements.heroPlayBtn.innerHTML = '<i class="ri-play-fill"></i> Play Track';
    }
}

/**
 * Update counters in sidebar and section header
 */
function updateSongCounters() {
    const count = state.songs.length;
    elements.sidebarSongCount.textContent = count;
    elements.songCounterSubtitle.textContent = `${count} ${count === 1 ? 'track' : 'tracks'} available`;
}

// ====================================================================
// ADMIN CRUD OPERATIONS
// ====================================================================

/**
 * Handle Add or Update form submission
 */
async function handleAdminFormSubmit(e) {
    e.preventDefault();

    if (!state.supabaseClient) {
        showToast('Please configure Supabase connection first!', 'error');
        openSettingsModal();
        return;
    }

    const title = elements.formTitle.value.trim();
    const artist = elements.formArtist.value.trim();
    const album = elements.formAlbum.value.trim() || 'Single';
    const cover_url = elements.formCoverUrl.value.trim();
    const audio_url = elements.formAudioUrl.value.trim();

    // Validation
    if (!title || !artist || !cover_url || !audio_url) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }

    elements.btnSubmitSong.disabled = true;
    elements.submitBtnText.textContent = state.isEditing ? 'Updating song...' : 'Saving to Supabase...';

    try {
        if (state.isEditing && state.editSongId) {
            // Update Existing Song
            const { error } = await state.supabaseClient
                .from('songs')
                .update({ title, artist, album, cover_url, audio_url })
                .eq('id', state.editSongId);

            if (error) throw error;

            showToast(`"${title}" updated successfully!`, 'success');
            cancelEditing();
        } else {
            // Insert New Song
            const { error } = await state.supabaseClient
                .from('songs')
                .insert([{ title, artist, album, cover_url, audio_url }]);

            if (error) throw error;

            showToast(`"${title}" added to Supabase!`, 'success');
            resetAdminForm();
        }

        // Refresh songs immediately
        await fetchSongs(false);

    } catch (err) {
        console.error('Admin operation failed:', err);
        showToast(`Operation failed: ${err.message || 'Check database permissions and RLS'}`, 'error');
    } finally {
        elements.btnSubmitSong.disabled = false;
        elements.submitBtnText.textContent = state.isEditing ? 'Update Song' : 'Add Song to Supabase';
    }
}

/**
 * Set up form for editing a song
 */
function startEditingSong(song) {
    state.isEditing = true;
    state.editSongId = song.id;

    elements.formSongId.value = song.id;
    elements.formTitle.value = song.title;
    elements.formArtist.value = song.artist;
    elements.formAlbum.value = song.album || '';
    elements.formCoverUrl.value = song.cover_url;
    elements.formCoverPreview.src = song.cover_url;
    elements.formAudioUrl.value = song.audio_url;

    elements.adminFormHeading.innerHTML = `<i class="ri-edit-line"></i> Edit "${escapeHtml(song.title)}"`;
    elements.submitBtnText.textContent = 'Update Song in Supabase';
    elements.btnCancelEdit.classList.remove('hidden');

    switchTab('admin');
    elements.adminSongForm.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Cancel Editing state
 */
function cancelEditing() {
    state.isEditing = false;
    state.editSongId = null;
    resetAdminForm();
    elements.adminFormHeading.innerHTML = '<i class="ri-add-circle-line"></i> Add New Track';
    elements.submitBtnText.textContent = 'Add Song to Supabase';
    elements.btnCancelEdit.classList.add('hidden');
}

/**
 * Reset form fields to defaults
 */
function resetAdminForm() {
    elements.adminSongForm.reset();
    elements.formSongId.value = '';
    const defaultCover = (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.defaultCoverUrl : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=160&q=80');
    elements.formCoverPreview.src = defaultCover;
}

/**
 * Confirm and delete a song from Supabase
 */
async function confirmDeleteSong(id, title) {
    if (!state.supabaseClient) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${title}" from Supabase?`);
    if (!confirmed) return;

    try {
        const { error } = await state.supabaseClient
            .from('songs')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast(`"${title}" deleted successfully.`, 'info');

        // If the deleted song is currently playing, stop it
        if (state.currentSongIndex !== -1 && state.filteredSongs[state.currentSongIndex]?.id === id) {
            pauseTrack();
            state.currentSongIndex = -1;
            elements.playerTitle.textContent = 'No Track Selected';
            elements.playerArtist.textContent = 'Select a song to start streaming';
        }

        // Cancel edit if deleting the song being edited
        if (state.editSongId === id) {
            cancelEditing();
        }

        await fetchSongs(false);

    } catch (err) {
        console.error('Delete song failed:', err);
        showToast(`Failed to delete song: ${err.message}`, 'error');
    }
}

// ====================================================================
// SEARCH & FILTERING
// ====================================================================

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();

    if (query === '') {
        elements.searchClearBtn.classList.add('hidden');
        state.filteredSongs = [...state.songs];
    } else {
        elements.searchClearBtn.classList.remove('hidden');
        state.filteredSongs = state.songs.filter(song => {
            const titleMatch = song.title && song.title.toLowerCase().includes(query);
            const artistMatch = song.artist && song.artist.toLowerCase().includes(query);
            const albumMatch = song.album && song.album.toLowerCase().includes(query);
            return titleMatch || artistMatch || albumMatch;
        });
    }

    renderSongs(state.filteredSongs);
}

// ====================================================================
// EVENT LISTENERS & NAVIGATION
// ====================================================================

function setupEventListeners() {
    // Tab switching
    elements.navDiscover.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('discover');
    });

    elements.navSongs.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('discover');
    });

    elements.navAdmin.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('admin');
    });

    elements.heroAdminBtn.addEventListener('click', () => switchTab('admin'));
    elements.btnHeaderAdmin.addEventListener('click', () => switchTab('admin'));
    elements.btnEmptyAddSong.addEventListener('click', () => switchTab('admin'));

    // Hero Play button
    elements.heroPlayBtn.addEventListener('click', () => {
        if (state.isPlaying) {
            pauseTrack();
        } else {
            if (state.currentSongIndex !== -1) {
                playTrack();
            } else if (state.songs.length > 0) {
                loadSong(0, true);
            }
        }
    });

    // Mobile sidebar toggle
    elements.mobileMenuBtn.addEventListener('click', () => {
        elements.sidebar.classList.add('open');
    });

    elements.mobileCloseBtn.addEventListener('click', () => {
        elements.sidebar.classList.remove('open');
    });

    // Refresh buttons
    elements.btnRefresh.addEventListener('click', () => {
        fetchSongs(true);
        showToast('Refreshing tracks from Supabase...', 'info');
    });
    elements.btnAdminRefresh.addEventListener('click', () => {
        fetchSongs(false);
        showToast('Admin table refreshed.', 'info');
    });

    // View toggle (Grid / List)
    elements.btnGridView.addEventListener('click', () => setViewMode('grid'));
    elements.btnListView.addEventListener('click', () => setViewMode('list'));

    // Search events
    elements.searchInput.addEventListener('input', handleSearch);
    elements.searchClearBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        handleSearch({ target: elements.searchInput });
        elements.searchInput.focus();
    });

    // Admin Form
    elements.adminSongForm.addEventListener('submit', handleAdminFormSubmit);
    elements.btnCancelEdit.addEventListener('click', cancelEditing);

    // Live Cover Image Preview
    elements.formCoverUrl.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        elements.formCoverPreview.src = url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=160&q=80';
    });

    // Quick Paste Example Audio URL
    elements.btnUseExampleUrl.addEventListener('click', () => {
        const exampleUrl = typeof SUPABASE_CONFIG !== 'undefined' 
            ? SUPABASE_CONFIG.defaultAudioUrl 
            : 'https://res.cloudinary.com/tyqpilxi/video/upload/v1790314415/Ey_Inga_Paaru-StarMusiQ.Com.mp3';
        elements.formAudioUrl.value = exampleUrl;
        showToast('Pasted sample Cloudinary audio URL!', 'info');
    });

    // Supabase Settings Modal
    elements.btnOpenSettings.addEventListener('click', openSettingsModal);
    elements.btnConfigGear.addEventListener('click', openSettingsModal);
    elements.btnCloseSettingsModal.addEventListener('click', closeSettingsModal);
    elements.btnErrorSetup.addEventListener('click', openSettingsModal);
    elements.btnErrorRetry.addEventListener('click', () => fetchSongs(true));

    elements.settingsForm.addEventListener('submit', handleSaveSettings);
    elements.btnTestSupabaseConnection.addEventListener('click', handleTestConnection);

    // SQL Guide Modal
    elements.btnOpenSqlGuide.addEventListener('click', openSqlModal);
    elements.btnCloseSqlModal.addEventListener('click', closeSqlModal);
    elements.btnCopySql.addEventListener('click', handleCopySql);

    // Close modals on outside backdrop click
    window.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettingsModal();
        if (e.target === elements.sqlGuideModal) closeSqlModal();
    });
}

/**
 * Switch Active Tab
 */
function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        }
    });

    if (tabName === 'discover' || tabName === 'songs') {
        elements.tabDiscover.classList.add('active');
        elements.tabAdmin.classList.remove('active');
    } else if (tabName === 'admin') {
        elements.tabAdmin.classList.add('active');
        elements.tabDiscover.classList.remove('active');
    }

    // Close mobile sidebar if open
    elements.sidebar.classList.remove('open');
}

/**
 * Toggle View Mode (Grid vs List)
 */
function setViewMode(mode) {
    state.viewMode = mode;
    elements.songsContainer.className = `songs-container ${mode}-view`;
    elements.btnGridView.classList.toggle('active', mode === 'grid');
    elements.btnListView.classList.toggle('active', mode === 'list');
}

// ====================================================================
// SETTINGS & DATABASE MANAGEMENT
// ====================================================================

function openSettingsModal() {
    elements.settingsModal.classList.remove('hidden');
    elements.modalTestStatus.classList.add('hidden');
}

function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
}

function openSqlModal() {
    elements.sqlGuideModal.classList.remove('hidden');
}

function closeSqlModal() {
    elements.sqlGuideModal.classList.add('hidden');
}

function handleCopySql() {
    const code = document.getElementById('sqlCodeBlock').textContent;
    navigator.clipboard.writeText(code).then(() => {
        elements.btnCopySql.innerHTML = '<i class="ri-check-line"></i> Copied!';
        setTimeout(() => {
            elements.btnCopySql.innerHTML = '<i class="ri-file-copy-line"></i> Copy SQL';
        }, 2000);
    });
}

/**
 * Save Supabase Credentials
 */
function handleSaveSettings(e) {
    e.preventDefault();
    const url = elements.cfgSupabaseUrl.value.trim();
    const key = elements.cfgSupabaseKey.value.trim();

    if (!url || !key) {
        showToast('Please provide both Project URL and Anon API Key.', 'error');
        return;
    }

    localStorage.setItem('soundpulse_supabase_url', url);
    localStorage.setItem('soundpulse_supabase_key', key);

    closeSettingsModal();
    showToast('Supabase settings saved! Connecting...', 'success');
    initSupabase();
}

/**
 * Test Supabase Connection
 */
async function handleTestConnection() {
    const url = elements.cfgSupabaseUrl.value.trim();
    const key = elements.cfgSupabaseKey.value.trim();

    if (!url || !key) {
        showModalStatus('Please fill in both URL and Key first.', 'error');
        return;
    }

    showModalStatus('Connecting and testing "songs" table...', 'pending');

    try {
        const testClient = window.supabase.createClient(url, key);
        const { data, error } = await testClient.from('songs').select('id').limit(1);

        if (error) throw error;

        showModalStatus('Connection successful! The "songs" table was reached.', 'success');
    } catch (err) {
        showModalStatus(`Connection failed: ${err.message || 'Make sure the songs table exists with RLS enabled.'}`, 'error');
    }
}

function showModalStatus(message, type) {
    elements.modalTestStatus.textContent = message;
    elements.modalTestStatus.className = `modal-test-status ${type}`;
    elements.modalTestStatus.classList.remove('hidden');
}

function updateDbStatus(status, text) {
    elements.dbStatusDot.className = `status-indicator status-${status}`;
    elements.dbStatusText.textContent = text;
}

function showErrorState(msg) {
    elements.songsContainer.innerHTML = '';
    elements.emptyState.classList.add('hidden');
    elements.errorState.classList.remove('hidden');
    elements.errorMessage.textContent = msg;
}

function checkInitialSettings() {
    const savedUrl = localStorage.getItem('soundpulse_supabase_url') || 
                     (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.supabaseUrl : '');
    if (!savedUrl) {
        // Prompt with a gentle notification
        setTimeout(() => {
            showToast('Welcome to SoundPulse! Connect your Supabase project in Settings.', 'info');
        }, 1000);
    }
}

// ====================================================================
// KEYBOARD SHORTCUTS
// ====================================================================

function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts if user is typing in an input or textarea
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            return;
        }

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (elements.audioEngine.duration) {
                    elements.audioEngine.currentTime = Math.min(
                        elements.audioEngine.duration, 
                        elements.audioEngine.currentTime + 5
                    );
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (elements.audioEngine.duration) {
                    elements.audioEngine.currentTime = Math.max(0, elements.audioEngine.currentTime - 5);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(Math.min(1, state.volume + 0.05));
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(Math.max(0, state.volume - 0.05));
                break;
            case 'KeyM':
                toggleMute();
                break;
            case 'KeyS':
                elements.btnShuffle.click();
                break;
            case 'KeyR':
                elements.btnRepeat.click();
                break;
        }
    });
}

// ====================================================================
// TOAST NOTIFICATION SYSTEM
// ====================================================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ri-information-line';
    if (type === 'success') icon = 'ri-checkbox-circle-line';
    if (type === 'error') icon = 'ri-error-warning-line';

    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

// ====================================================================
// UTILITY HELPERS
// ====================================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
