document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('rdToken');
  const btnValidate = document.getElementById('btnValidate');
  const tokenStatus = document.getElementById('tokenStatus');
  const btnInstall = document.getElementById('btnInstall');
  const btnCopy = document.getElementById('btnCopy');
  const installNotice = document.getElementById('installNotice');
  const manifestUrlInput = document.getElementById('manifestUrlInput');
  const btnSelectAllProviders = document.getElementById('btnSelectAllProviders');
  const btnDeselectAllProviders = document.getElementById('btnDeselectAllProviders');

  // Select / Deselect All Providers
  if (btnSelectAllProviders) {
    btnSelectAllProviders.addEventListener('click', () => {
      document.querySelectorAll('input[name="providers"]').forEach((cb) => {
        cb.checked = true;
      });
    });
  }

  if (btnDeselectAllProviders) {
    btnDeselectAllProviders.addEventListener('click', () => {
      document.querySelectorAll('input[name="providers"]').forEach((cb) => {
        cb.checked = false;
      });
    });
  }

  // Validate Real-Debrid token
  btnValidate.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      showStatus('Please enter a Real-Debrid API token first.', 'error');
      return;
    }

    btnValidate.disabled = true;
    btnValidate.textContent = 'Checking...';
    tokenStatus.classList.add('hidden');

    try {
      const res = await fetch('/api/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        showStatus(
          `✅ Valid token! Account: ${data.user.username} (${data.user.type}) - Premium until: ${new Date(data.user.expiration).toLocaleDateString()}`,
          'success'
        );
      } else {
        showStatus(`❌ ${data.error || 'Invalid API token'}`, 'error');
      }
    } catch {
      showStatus('❌ Failed to connect to addon server for validation', 'error');
    } finally {
      btnValidate.disabled = false;
      btnValidate.textContent = 'Validate Key';
    }
  });

  function showStatus(text, type) {
    tokenStatus.textContent = text;
    tokenStatus.className = `status-box ${type}`;
    tokenStatus.classList.remove('hidden');
  }

  // Gather config parameters from form
  function collectConfig() {
    const token = tokenInput.value.trim();
    if (!token) {
      showStatus('Please enter your Real-Debrid API token before installing.', 'error');
      tokenInput.focus();
      return null;
    }

    const resCheckboxes = document.querySelectorAll('input[name="resolutions"]:checked');
    const preferredResolutions = Array.from(resCheckboxes).map((cb) => cb.value);

    const providerCheckboxes = document.querySelectorAll('input[name="providers"]:checked');
    const enabledProviders = Array.from(providerCheckboxes).map((cb) => cb.value);

    if (enabledProviders.length === 0) {
      showStatus('Please select at least one torrent provider.', 'error');
      return null;
    }

    const maxResults = parseInt(document.getElementById('maxResults').value, 10) || 30;
    const maxResultsPerQuality = parseInt(document.getElementById('maxResultsPerQuality').value, 10) || 0;
    const maxFileSizeGb = parseFloat(document.getElementById('maxFileSizeGb').value) || 0;
    const sortOrder = document.getElementById('sortOrder').value;
    const showCachedOnly = document.getElementById('showCachedOnly').checked;

    return {
      rdToken: token,
      maxResults,
      maxResultsPerQuality,
      preferredResolutions,
      preferredSources: ['REMUX', 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV'],
      preferredCodecs: ['HEVC', 'AVC', 'AV1'],
      maxFileSizeGb,
      excludedResolutions: [],
      enabledProviders,
      showCachedOnly,
      sortOrder,
    };
  }

  // Generate manifest URL
  async function generateUrls() {
    const config = collectConfig();
    if (!config) return null;

    try {
      const res = await fetch('/api/encode-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        showStatus(`❌ Error generating configuration: ${data.error}`, 'error');
        return null;
      }

      if (data && data.manifestUrl) {
        if (data.manifestUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
          const origin = window.location.origin;
          data.manifestUrl = data.manifestUrl.replace(/^https?:\/\/[^\/]+/, origin);
          data.stremioInstallUrl = data.manifestUrl.replace(/^https?:\/\//, 'stremio://');
        }
      }

      return data;
    } catch {
      showStatus('❌ Error communicating with addon server', 'error');
      return null;
    }
  }

  // Install button click
  btnInstall.addEventListener('click', async () => {
    const urls = await generateUrls();
    if (!urls) return;

    manifestUrlInput.value = urls.manifestUrl;
    installNotice.classList.remove('hidden');

    // Trigger stremio:// protocol handler
    window.location.href = urls.stremioInstallUrl;
  });

  // Copy URL button click
  btnCopy.addEventListener('click', async () => {
    const urls = await generateUrls();
    if (!urls) return;

    manifestUrlInput.value = urls.manifestUrl;
    installNotice.classList.remove('hidden');

    try {
      await navigator.clipboard.writeText(urls.manifestUrl);
      btnCopy.textContent = '✅ Copied to Clipboard!';
      setTimeout(() => {
        btnCopy.textContent = '📋 Copy Manifest URL';
      }, 3000);
    } catch {
      manifestUrlInput.select();
    }
  });

  // Check if page opened with existing configuration in URL path (e.g. /:config/configure)
  async function loadExistingConfig() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    let configPayload = null;
    if (pathParts.length >= 2 && pathParts[pathParts.length - 1] === 'configure') {
      configPayload = pathParts[pathParts.length - 2];
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      configPayload = urlParams.get('config');
    }

    if (!configPayload || configPayload === 'configure') return;

    try {
      const res = await fetch(`/api/decode-config/${encodeURIComponent(configPayload)}`);
      const data = await res.json();
      if (!res.ok || !data.ok || !data.config) return;

      const cfg = data.config;
      if (cfg.rdToken) {
        tokenInput.value = cfg.rdToken;
        btnValidate.click(); // Auto-validate token
      }
      if (cfg.sortOrder) {
        const sortEl = document.getElementById('sortOrder');
        if (sortEl) sortEl.value = cfg.sortOrder;
      }
      if (cfg.maxResults) {
        const maxResultsEl = document.getElementById('maxResults');
        if (maxResultsEl) maxResultsEl.value = cfg.maxResults;
      }
      if (cfg.maxResultsPerQuality !== undefined) {
        const mqEl = document.getElementById('maxResultsPerQuality');
        if (mqEl) mqEl.value = cfg.maxResultsPerQuality;
      }
      if (cfg.maxFileSizeGb !== undefined) {
        const fsEl = document.getElementById('maxFileSizeGb');
        if (fsEl) fsEl.value = cfg.maxFileSizeGb;
      }
      if (cfg.showCachedOnly !== undefined) {
        const scEl = document.getElementById('showCachedOnly');
        if (scEl) scEl.checked = cfg.showCachedOnly;
      }
      if (cfg.enabledProviders && Array.isArray(cfg.enabledProviders)) {
        document.querySelectorAll('input[name="providers"]').forEach((cb) => {
          cb.checked = cfg.enabledProviders.includes(cb.value);
        });
      }
      if (cfg.preferredResolutions && Array.isArray(cfg.preferredResolutions)) {
        document.querySelectorAll('input[name="resolutions"]').forEach((cb) => {
          cb.checked = cfg.preferredResolutions.includes(cb.value);
        });
      }

      btnInstall.textContent = '⚡ Update Addon in Stremio';
      showStatus('ℹ️ Loaded existing addon configuration for editing', 'info');
    } catch (e) {
      console.error('Failed to load existing config:', e);
    }
  }

  loadExistingConfig();
});
