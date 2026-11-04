import type { H3Event } from 'h3';
import type { Principal } from '../../utils/principal';
import type { MountRoute } from '../mount';
import { ELEVATION_REQUIRED } from './instance';

const dataDir = () => useDeploymentConfig().dataDir;

const requireSnapshot = (event: H3Event) => {
  const name = getRouterParam(event, 'name', { decode: true }) ?? '';
  const snapshot = findSnapshot(dataDir(), name);
  if (!snapshot) throw notFound(`Snapshot ${name} does not exist`);
  return snapshot;
};

const snapshotList = (_event: H3Event, principal: Principal) => {
  requireElevation(principal);
  return listSnapshots(dataDir());
};

const snapshotTake = (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  try {
    const snapshot = takeSnapshot(useStore(), dataDir(), manualStem());
    setResponseStatus(event, 201);
    return snapshot;
  }
  catch (error) {
    throw internalError(`Snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const snapshotDownload = (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const { name } = requireSnapshot(event);
  setResponseHeader(event, 'content-type', 'application/vnd.sqlite3');
  setResponseHeader(event, 'content-disposition', `attachment; filename="${name}.sqlite"`);
  return readSnapshot(dataDir(), name);
};

const snapshotDelete = (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  deleteSnapshot(dataDir(), requireSnapshot(event).name);
  return sendNoContent(event);
};

const SNAPSHOT_SCHEMA = {
  type: 'object',
  properties: { name: { type: 'string' }, kind: { type: 'string', enum: ['pre-migrate', 'manual'] }, takenAt: { type: 'string' }, size: { type: 'integer', description: 'Bytes' } },
  required: ['name', 'kind', 'takenAt', 'size'],
};
const NO_SUCH_SNAPSHOT = { description: 'No such Snapshot' };

export const snapshotAdminRoutes: MountRoute[] = [
  {
    method: 'get',
    path: '/snapshots',
    handler: snapshotList,
    openapi: {
      summary: 'List the Snapshots in backups/, newest first',
      tags: ['snapshots'],
      responses: { 200: { description: 'Snapshots', schema: { type: 'array', items: SNAPSHOT_SCHEMA } }, 403: ELEVATION_REQUIRED },
    },
  },
  {
    method: 'post',
    path: '/snapshots',
    handler: snapshotTake,
    openapi: {
      summary: 'Take a manual Snapshot now',
      tags: ['snapshots'],
      responses: { 201: { description: 'The new Snapshot', schema: SNAPSHOT_SCHEMA }, 403: ELEVATION_REQUIRED, 500: { description: 'The Snapshot failed (code internal); no file is left behind' } },
    },
  },
  {
    method: 'get',
    path: '/snapshots/:name',
    handler: snapshotDownload,
    openapi: {
      summary: 'Download a Snapshot as its SQLite file',
      tags: ['snapshots'],
      responses: { 200: { description: 'The SQLite file', contentType: 'application/vnd.sqlite3', schema: { type: 'string', format: 'binary' } }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_SNAPSHOT },
    },
  },
  {
    method: 'delete',
    path: '/snapshots/:name',
    handler: snapshotDelete,
    openapi: {
      summary: 'Delete a manual Snapshot',
      tags: ['snapshots'],
      responses: { 204: { description: 'Deleted' }, 400: { description: 'A pre-migrate Snapshot (field name)' }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_SNAPSHOT },
    },
  },
];
