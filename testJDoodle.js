const axios = require('axios');
require('dotenv').config(); // loads .env

const testJDoodle = async () => {
  const payload = {
    script: `
      #include <iostream>
      using namespace std;

      int main() {
        cout << "Hello from C++ on JDoodle!" << endl;
        return 0;
      }
    `,
    language: "cpp", // ✅ JDoodle requires "cpp" for C++
    versionIndex: "5", // ✅ JDoodle version index for C++
    clientId: process.env.JD_CLIENT_ID,
    clientSecret: process.env.JD_CLIENT_SECRET
  };

  console.log("Sending payload to JDoodle:");
  console.log(payload);

  try {
    const response = await axios.post("https://api.jdoodle.com/v1/execute", payload);
    console.log("\n✅ JDoodle Response:");
    console.log(response.data);
  } catch (err) {
    console.error("\n❌ JDoodle Error:");
    console.error(err.response?.data || err.message);
  }
};

testJDoodle();
