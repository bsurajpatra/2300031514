const express = require('express');
const devLogger = require('./src/middlewares/loggerMiddleware');

const app = express();
app.use(express.json());
app.use(devLogger);     

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is happily running on port ${PORT}`);
});