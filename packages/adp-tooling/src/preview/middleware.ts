import { LogLevel, ToolsLogger, UI5ToolingTransport } from '@sap-ux/logger';
import type { MiddlewareParameters } from '@ui5/server';
import type { RequestHandler } from 'express';
import { FlpSandbox } from '@sap-ux/preview-middleware';
import { AdpPreview } from './adp-preview';
import type { AdpPreviewConfig } from '../types';

/**
 * Create the router that is to be exposed as UI5 middleware.
 *
 * @param param0 parameters provider by UI5
 * @param param0.resources reference to resources
 * @param param0.options options and configurations from the ui5.yaml
 * @param param0.middlewareUtil additional UI5 CLI utilities
 * @param logger logger instance
 * @returns a router
 */
async function createRouter(
    { resources, options, middlewareUtil }: MiddlewareParameters<AdpPreviewConfig>,
    logger: ToolsLogger
) {
    const config = options.configuration;
    if (!config) {
        throw new Error('Invalid');
    }

    const flp = new FlpSandbox(config.flp ?? {}, resources.rootProject, middlewareUtil, logger);
    const appVariant = await resources.rootProject.byPath('/manifest.appdescr_variant');
    if (appVariant) {
        const adp = new AdpPreview(config.adp, resources.rootProject, logger);
        const layer = await adp.init(JSON.parse(await appVariant.getString()));
        flp.config.rta = { layer };
        await flp.init(adp.descriptor.manifest, adp.descriptor.name, adp.resources);
        flp.router.use(adp.descriptor.url, adp.proxy.bind(adp) as RequestHandler);
    } else {
        throw new Error('No manifest.appdescr_variant found.');
    }
    // add exposed endpoints for cds-plugin-ui5
    flp.router.getAppPages = () => [`${flp.config.path}#${flp.config.intent.object}-${flp.config.intent.action}`];
    return flp.router;
}

/**
 * Exporting the middleware for usage in the UI5 tooling.
 *
 * @param params middleware configuration
 * @returns a promise for the request handler
 */
module.exports = async (params: MiddlewareParameters<AdpPreviewConfig>): Promise<RequestHandler> => {
    const logger = new ToolsLogger({
        transports: [new UI5ToolingTransport({ moduleName: 'adaptation-preview-middleware' })],
        logLevel: params.options.configuration?.debug ? LogLevel.Debug : LogLevel.Info
    });
    try {
        return await createRouter(params, logger);
    } catch (error) {
        logger.error('Could not start preview-middleware.');
        logger.error(error.message);
        throw error;
    }
};
