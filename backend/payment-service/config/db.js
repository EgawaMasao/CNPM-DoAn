const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });
        console.log("✅ MongoDB Connected - Payment Service");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
        // In tests we should not terminate the process as Jest runs tests in worker
        // child processes and calling process.exit will crash the worker and make
        // the test run fail with retry-limit errors. Instead re-throw the error
        // so the test framework can handle it. In non-test environments we keep
        // the existing behavior to fail fast.
        if (process.env.NODE_ENV === "test") {
            throw error;
        }
        process.exit(1);
    }
};

module.exports = connectDB;
