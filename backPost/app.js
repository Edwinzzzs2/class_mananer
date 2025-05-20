const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedule');

app.use('/api/auth', authRoutes);
app.use('/api/schedule', scheduleRoutes); 