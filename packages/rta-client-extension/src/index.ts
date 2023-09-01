import Log from 'sap/base/Log';
import type RuntimeAuthoring from 'sap/ui/rta/RuntimeAuthoring';

/**
 * Initialize custom plugins.
 *
 * @param _rta reference to the active runtime adaptation layer
 */
function init(_rta: RuntimeAuthoring) {
    // add code to load custom plugins here
    Log.debug('RTA plugin initialized.');
}

export default init;
