const { httpServer } = require('./app');

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
    console.log(`\n🚀 AgentSlam API running on port ${PORT}`);
    console.log(`   • REST: http://localhost:${PORT}/api`);
    console.log(`   • Health: http://localhost:${PORT}/api/health`);
    console.log(`   • Env: ${process.env.NODE_ENV || 'development'}\n`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err.message);
    httpServer.close(() => process.exit(1));
});
