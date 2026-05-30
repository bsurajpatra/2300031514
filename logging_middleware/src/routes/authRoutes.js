const express = require('express');
const router = express.Router();
const { Log } = require('../../index');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    Log('backend', 'warn', 'controller', 'Login failed: missing username or password')
      .catch((err) => console.error(`[Controller Log Error] ${err.message}`));
      
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username === 'admin' && password === 'admin') {
    Log('backend', 'info', 'controller', 'Admin login successful')
      .catch((err) => console.error(`[Controller Log Error] ${err.message}`));
      
    return res.json({ message: 'Login successful', token: 'mock_token' });
  } else {
    Log('backend', 'error', 'controller', `Failed login attempt for user: ${username}`)
      .catch((err) => console.error(`[Controller Log Error] ${err.message}`));
      
    return res.status(401).json({ error: 'Invalid credentials' });
  }
});

module.exports = router;
