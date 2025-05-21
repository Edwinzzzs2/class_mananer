const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedule');
const kdocsExportRouter = require('./routes/kdocsExport');

app.use('/api/auth', authRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use(kdocsExportRouter); 