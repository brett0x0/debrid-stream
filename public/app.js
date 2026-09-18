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
});
