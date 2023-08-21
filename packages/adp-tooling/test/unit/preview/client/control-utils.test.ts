import ControlUtils from '../../../../src/preview/client/control-utils';

jest.mock('sap/ui/fl/Utils', () => jest.fn());

describe('client/control-utils', () => {
    describe('', () => {
        test('test something', () => {
            const result = ControlUtils.getControlAggregationByName({} as any, 'test');
            expect(result).toHaveLength(1);
        });
    });
});
