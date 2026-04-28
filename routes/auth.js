const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, email, password: hashedPassword, role });
        await newUser.save();

        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password, deviceId } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Device Binding Logic for students
        if (user.role === 'student' && deviceId) {
            if (!user.deviceId) {
                // First login, bind device
                user.deviceId = deviceId;
                await user.save();
            } else if (user.deviceId !== deviceId) {
                return res.status(403).json({ success: false, message: 'Login denied: Device mismatch. Please use your registered device.' });
            }
        }
        
        // Setup session
        req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role };
        
        res.json({ success: true, user: req.session.user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Check Session
router.get('/me', (req, res) => {
    if (req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'Not logged in' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
