async function deploy() {
  const token = 'rnd_nukSCEVpHDWbe07Y2in7XnIHRpbT';
  const ownerId = 'tea-damnsvlbedkc73f4mll0';
  const repoUrl = 'https://github.com/brettg1/debrid-stream';

  const payload = {
    type: 'web_service',
    name: 'debrid-stream',
    ownerId: ownerId,
    repo: repoUrl,
    branch: 'main',
    autoDeploy: 'yes',
    serviceDetails: {
      env: 'node',
      plan: 'free',
      region: 'oregon',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm start',
      envVars: [
        { key: 'PORT', value: '7000' },
        { key: 'NODE_ENV', value: 'production' },
        { key: 'SECRET_KEY', value: 'debrid-stream-secret-key-32-chars-long!' }
      ]
    }
  };

  const res = await fetch('https://api.render.com/v1/services', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

deploy();
