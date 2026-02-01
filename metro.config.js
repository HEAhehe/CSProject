// เปลี่ยนจาก 'expo/metro-config' เป็น '@expo/metro-config'
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ ปิดตัวที่ทำให้เกิด Error: require doesn't exist
config.resolver.unstable_enablePackageExports = false;

module.exports = config;