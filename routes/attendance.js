const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const qrcode = require('qrcode');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next();
};

// Create a new QR session (Teacher)
router.post('/session/create', requireAuth, async (req, res) => {
    try {
        if (req.session.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        
        const { subject } = req.body;
        if (!subject) return res.status(400).json({ success: false, message: 'Subject is required' });

        const teacherId = req.session.user.id;
        const sessionId = Math.random().toString(36).substring(2, 15); // Random string
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + 30000); // +30 seconds
        
        const session = new Session({ sessionId, teacherId, subject, createdAt, expiresAt });
        await session.save();

        // Generate QR code (Data URL) containing the sessionId
        const qrCodeDataUrl = await qrcode.toDataURL(sessionId);

        res.json({ success: true, session, qrCodeDataUrl });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Mark attendance via QR (Student)
router.post('/mark', requireAuth, async (req, res) => {
    try {
        if (req.session.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const studentId = req.session.user.id;
        const { sessionId, deviceId, location } = req.body;

        // Verify device binding
        const user = await User.findById(studentId);
        if (user.deviceId && user.deviceId !== deviceId) {
            return res.status(403).json({ success: false, message: 'Device mismatch. Use your registered device.' });
        }

        // Find session
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ success: false, message: 'Invalid session code' });
        }

        if (!session.isActive) {
            return res.status(400).json({ success: false, message: 'Session has been ended by the teacher' });
        }

        // Check expiration
        if (new Date() > session.expiresAt) {
            return res.status(400).json({ success: false, message: 'Session has expired' });
        }

        // TODO: GPS Location Verification
        // In the future, verify if `location` (lat/lng) matches the teacher's expected coordinates
        // if (!isValidLocation(location)) return res.status(400).json({ success: false, message: 'Out of range' });

        // Record attendance
        const attendance = new Attendance({ studentId, sessionId: session._id, location });
        await attendance.save();

        res.json({ success: true, message: 'Attendance marked successfully' });
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error from our schema index
            return res.status(400).json({ success: false, message: 'Attendance already marked for this session' });
        }
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get attendance for a session (Teacher)
router.get('/session/:sessionId', requireAuth, async (req, res) => {
    try {
        if (req.session.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const session = await Session.findOne({ sessionId: req.params.sessionId });
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        const attendanceRecords = await Attendance.find({ sessionId: session._id })
            .populate('studentId', 'name email');
        
        res.json({ success: true, records: attendanceRecords });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Reset a student's device binding (Teacher)
router.post('/reset-device/:studentId', requireAuth, async (req, res) => {
    try {
        if (req.session.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const student = await User.findById(req.params.studentId);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        student.deviceId = null;
        await student.save();

        res.json({ success: true, message: 'Device reset successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// End an active QR session (Teacher)
router.post('/session/end', requireAuth, async (req, res) => {
    try {
        if (req.session.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        
        const { sessionId } = req.body;
        const session = await Session.findOne({ sessionId, teacherId: req.session.user.id });
        
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        session.isActive = false;
        await session.save();

        res.json({ success: true, message: 'Session ended successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get attendance report (Teacher)
router.get('/report', requireAuth, async (req, res) => {
    try {
        if (req.session.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const { date } = req.query; // format: YYYY-MM-DD
        let sessionQuery = { teacherId: req.session.user.id };

        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            sessionQuery.createdAt = { $gte: startDate, $lt: endDate };
        }

        const sessions = await Session.find(sessionQuery);
        const sessionIds = sessions.map(s => s._id);

        const attendanceRecords = await Attendance.find({ sessionId: { $in: sessionIds } })
            .populate('studentId', 'name email')
            .populate('sessionId', 'subject createdAt');
        
        res.json({ success: true, records: attendanceRecords });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
