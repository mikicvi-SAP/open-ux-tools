const location = require.resolve('@sap-ux-private/rta-client-extension');
const fs = require('fs');
const path = require('path');

const index = fs.readFileSync(location);
const target = path.join(__dirname, 'dist/preview/client');
if (!fs.existsSync(target)) {
    fs.mkdirSync(target);
}
fs.writeFileSync(path.join(target, 'index.js'), index);
