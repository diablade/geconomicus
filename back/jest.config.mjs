export default {
    testEnvironment: 'node',
    moduleNameMapper: {
        '^#config/(.*\\.js)$': '<rootDir>/config/$1'
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
