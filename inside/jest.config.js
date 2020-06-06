module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ["**/test/*.spec.ts"],
    verbose: true,
    modulePaths: ["<rootdir>/src/"]
};
