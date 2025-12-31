import {jest} from '@jest/globals';

const mockIoInstance = {
    to:   jest.fn().mockReturnThis(),
    emit: jest.fn()
};

function initIo() {
    return mockIoInstance;
}

function io() {
    return mockIoInstance;
}

export default {
    initIo,
    io
};
