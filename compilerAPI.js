const axios = require('axios');
require('dotenv').config();

const compileAndRun = async (code, language, versionIndex = "0", stdin = "") => {
  const versionMap = {
    cpp: "5",
    java: "4",
    python3: "4",
  };

  const payload = {
    script: code,
    language,
    versionIndex: versionMap[language] || versionIndex || "0",
    stdin: stdin,
    clientId: process.env.JD_CLIENT_ID,
    clientSecret: process.env.JD_CLIENT_SECRET,
  };

  console.log("JDoodle Request Payload:", JSON.stringify(payload, null, 2));

  try {
    const { data } = await axios.post("https://api.jdoodle.com/v1/execute", payload);
    console.log("JDoodle API Response:", data);

    if (data.output) return data.output;
    else throw new Error(data.error || "Unknown execution failure.");
  } catch (error) {
    console.error("JDoodle API Error:", error.response?.data || error.message);
    throw new Error("Code execution failed.");
  }
};

module.exports = compileAndRun;
