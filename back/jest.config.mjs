export default {
    testEnvironment: 'node',
    transform: {},
    // legacy_tests/** are empty placeholders kept for the v1→v2 migration; skip them
    // so Jest doesn't fail them with "must contain at least one test".
    testPathIgnorePatterns: ['/node_modules/', '/__test__/legacy_tests/'],
    moduleNameMapper: {
        '^#config/(.*\\.js)$': '<rootDir>/config/$1',
        '^#configTest/(.*)$': '<rootDir>/__test__/config/$1',
        // legacy routes (mounted in app.js) import '#constantes_legacy'
        '^#constantes_legacy$': '<rootDir>/config/constantes_deprecated.cjs',
    }
};
// transform: {
// 	'^.+\\.jsx?$': 'babel-jest', // For JavaScript and JSX files
// 	'^.+\\.mjs$': 'babel-jest',  // For ES modules
// },
// moduleFileExtensions: ['js', 'jsx', 'mjs'],
// testMatch: [
// 	'**/__tests__/**/*.[jt]s?(x)',
// 	'**/?(*.)+(spec|test).[tj]s?(x)',
// ],
// testPathIgnorePatterns: ['/node_modules/'],
