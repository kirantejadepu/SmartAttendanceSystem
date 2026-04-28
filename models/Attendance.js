const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: true
    },
    location: {
        type: Object, // TODO: Store actual coordinates (e.g., { lat: Number, lng: Number }) in the future
        default: null
    }
}, { timestamps: true });

// Prevent a student from marking attendance twice in the same session
AttendanceSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
