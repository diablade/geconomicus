import dotenv from 'dotenv'

dotenv.config({path: './../config/.env'});

const {
    NODE_ENV,
    GECO_VERSION,
    GECO_WEB_HOST,
    GECO_PORT_NODE,
    GECO_LOG_DEBUG,
    GECO_DB_CONFIG_HOSTNAME,
    GECO_DB_CONFIG_PORT,
    GECO_DB_CONFIG_COLLECTION,
    GECO_DB_CONFIG_USER,
    GECO_DB_CONFIG_PASSWORD,
    GECO_ADMIN_PASSWORD,
    ME_CONFIG_MONGODB_ENABLE_ADMIN,
    ME_CONFIG_BASICAUTH_USERNAME,
    ME_CONFIG_BASICAUTH_PASSWORD

} = process.env;

export default {
    environment:                NODE_ENV,
    version:                    GECO_VERSION,
    web_host:                   GECO_WEB_HOST,
    admin_password:             GECO_ADMIN_PASSWORD,
    port:                       GECO_PORT_NODE,
    log_debug:                  GECO_LOG_DEBUG,
    db_config_hostname:         GECO_DB_CONFIG_HOSTNAME,
    db_config_port:             GECO_DB_CONFIG_PORT,
    db_config_collection:       GECO_DB_CONFIG_COLLECTION,
    db_config_user:             GECO_DB_CONFIG_USER,
    db_config_password:         GECO_DB_CONFIG_PASSWORD,
    mongo_express_enable_admin: ME_CONFIG_MONGODB_ENABLE_ADMIN,
    mongo_express_username:     ME_CONFIG_BASICAUTH_USERNAME,
    mongo_express_password:     ME_CONFIG_BASICAUTH_PASSWORD,
}
