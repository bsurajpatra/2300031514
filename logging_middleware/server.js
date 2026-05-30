const express = require('express');
const devLogger = require('./src/middlewares/loggerMiddleware');
const authRoutes = require('./src/routes/authRoutes');

const app = express();
app.use(express.json());
app.use(devLogger);     
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is happily running on port ${PORT}`);
});