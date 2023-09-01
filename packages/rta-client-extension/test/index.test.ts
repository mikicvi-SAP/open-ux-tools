import init from '../src/index';
import Log from 'sap/base/Log';
import type RuntimeAuthoring from 'sap/ui/rta/RuntimeAuthoring';

const mockDebug = Log.debug as jest.Mock;

describe('initPlugin', () => {
    test('logger is called', () => {
        init({} as RuntimeAuthoring);
        expect(mockDebug).toBeCalled();
    });
});
