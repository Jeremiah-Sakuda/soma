import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  normalizeBlackboardCatalog,
  canonicalBlackboardCourseUrl,
  parseBlackboardCourseUrl,
  isAllowedBlackboardRequest,
  type BlackboardCatalogCourse,
} from '../../domain/blackboard-navigation';
import type { VerifiedAccount } from '../account';
import { assertVerifiedAccount } from '../account';
import { getServerFirestore } from '../firebase-config';
import { readAccountWorkspace, updateAccountWorkspace } from '../account-store';
import { WorkspaceStoreError } from '../store';
import {
  acquireConnectionLease,
  releaseConnectionLease,
  connectionPublicationGuard,
  listConnections,
} from './store';
import { readBlackboardJson, validateBlackboardReadPath } from './blackboard-api';
import { collectBlackboardMaterials } from './blackboard-materials';
import { publishBlackboardRead, withdrawBlackboardSources } from './blackboard-publication';
import { withBrowserRead, type Configuration, type BlackboardSelection } from './browser';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const fail = (message: string, status = 409, code = 'blackboard_navigation') =>
  new WorkspaceStoreError(message, status, code);
const rootOf = (account: VerifiedAccount) => {
  assertVerifiedAccount(account);
  return getServerFirestore().collection('somaAccounts').doc(hash(account.uid));
};
export const blackboardActionSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('discover'),
    query: z.string().trim().max(200).optional(),
    more: z.boolean().optional(),
  }),
  z.strictObject({
    action: z.literal('select'),
    courseIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,160}$/)),
    mappings: z
      .record(z.string().regex(/^[A-Za-z0-9_-]{1,160}$/), z.string().min(1).max(128))
      .optional(),
  }),
]);

async function catalogRows(
  account: VerifiedAccount,
  workspaceId: string,
  ids: string[],
  epoch?: string,
): Promise<BlackboardCatalogCourse[]> {
  const root = rootOf(account);
  return root.firestore.runTransaction(
    async (tx) => {
      const owner = (await tx.get(root)).data();
      if (
        !owner ||
        owner.deleted ||
        owner.ownerId !== account.uid ||
        owner.workspaceId !== workspaceId
      )
        throw fail('Workspace changed. Reload the course list.', 409, 'workspace_changed');
      const rows: BlackboardCatalogCourse[] = [];
      for (const id of ids) {
        const row = (await tx.get(root.collection('blackboardCatalog').doc(hash(id)))).data();
        if (
          !row ||
          row.ownerId !== account.uid ||
          row.workspaceId !== workspaceId ||
          row.course?.id !== id ||
          row.catalogEpoch !== epoch
        )
          throw fail(
            'Rediscover this course before selecting it.',
            409,
            'blackboard_catalog_changed',
          );
        rows.push(normalizeBlackboardCatalog([row.course])[0]);
      }
      return rows;
    },
    { readOnly: true },
  );
}
export async function blackboardStatus(account: VerifiedAccount) {
  const workspace = await readAccountWorkspace(account);
  if (!workspace) throw fail('Private workspace is unavailable.', 404);
  const connection = (await listConnections(account)).find(
    (item) => item.id === 'browser-blackboard',
  );
  const config = connection?.configuration as Configuration | undefined,
    bb = config?.blackboard;
  return {
    catalog: {
      courses: await catalogRows(account, workspace.id, bb?.catalogIds ?? [], bb?.catalogEpoch),
      checkedAt: bb?.catalogCheckedAt ?? '',
      complete: bb?.catalogComplete ?? false,
      query: bb?.catalogQuery ?? '',
      ...(bb?.nextCatalogPath ? { nextCursor: 'available' } : {}),
    },
    selected: bb?.selected ?? [],
  };
}

export async function discoverBlackboardCourses(
  account: VerifiedAccount,
  query = '',
  more = false,
) {
  if (query.length > 200) throw fail('Use a shorter course search.', 400);
  return withBrowserRead(
    account,
    'blackboard',
    (request) => isAllowedBlackboardRequest(request, [], 'catalog'),
    async ({ page, workspace, connection, guard, deadline, blockedOrigins }) => {
      // These GET routes were observed in the authenticated Ultra course list. Use the
      // browser's request context so cookies remain inside the owned browser session.
      let subjectId: string | undefined;
      const readJson = (path: string) =>
        readBlackboardJson(page.request, path, { subjectId }, deadline);
      const identity = z
        .object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/) })
        .safeParse(await readJson('/learn/api/v1/users/me'));
      if (!identity.success)
        throw fail('Blackboard account could not be verified.', 422, 'blackboard_unsupported');
      subjectId = identity.data.id;
      const membershipPath = `/learn/api/v1/users/${identity.data.id}/memberships`;
      const previous = connection.configuration.blackboard;
      if (more && previous?.catalogSubjectId !== subjectId)
        throw fail(
          'Blackboard account changed. Reload the course list.',
          409,
          'blackboard_catalog_changed',
        );
      if (more && (!previous?.nextCatalogPath || previous.catalogQuery !== query))
        throw fail(
          'Reload the course search before loading more.',
          409,
          'blackboard_catalog_changed',
        );
      const response = await readJson(
        more ? previous!.nextCatalogPath! : membershipPath + '?expand=course&limit=50',
      );
      const listing = z
        .object({
          results: z
            .array(
              z
                .object({
                  courseId: z.string().optional(),
                  course: z
                    .object({
                      id: z.string().optional(),
                      name: z.string().optional(),
                      courseId: z.string().optional(),
                    })
                    .passthrough()
                    .optional(),
                })
                .passthrough(),
            )
            .max(1000),
          paging: z.object({ nextPage: z.string().optional() }).passthrough().optional(),
        })
        .safeParse(response);
      if (!listing.success)
        throw fail(
          'Blackboard’s course-list format is not supported yet.',
          422,
          'blackboard_unsupported',
        );
      const candidates = listing.data.results.flatMap((item) =>
        item.course?.name && item.course.id
          ? [{ id: item.course.id, title: item.course.name, code: item.course.courseId }]
          : [],
      );
      if (listing.data.results.length && !candidates.length)
        throw fail(
          'Blackboard did not include verified course metadata.',
          422,
          'blackboard_unsupported',
        );
      let courses = normalizeBlackboardCatalog(candidates);
      if (query)
        courses = courses.filter((course) =>
          (course.code + ' ' + course.title + ' ' + course.term)
            .toLowerCase()
            .includes(query.toLowerCase()),
        );
      const complete =
          !!listing.data.paging &&
          !listing.data.paging.nextPage &&
          listing.data.results.length === candidates.length &&
          courses.length <= 50,
        pageCatalog = courses.slice(0, 50),
        checkedAt = new Date().toISOString(),
        root = rootOf(account);
      const epoch =
        previous?.catalogSubjectId === subjectId && previous?.catalogEpoch
          ? previous.catalogEpoch
          : randomUUID();
      const catalog = more
        ? normalizeBlackboardCatalog([
            ...(await catalogRows(account, workspace.id, previous?.catalogIds ?? [], epoch)),
            ...pageCatalog,
          ])
        : pageCatalog;
      if (catalog.length > 1000)
        throw fail(
          'This course catalog reached the read limit. Narrow the search.',
          413,
          'blackboard_catalog_capacity',
        );
      let nextPath = listing.data.paging?.nextPage;
      if (nextPath) {
        if (
          /[\u0000-\u0020\u007f\\]|%2f|%5c|%2e/i.test(nextPath) ||
          /(?:^|\/)\.{1,2}(?:\/|$)/.test(nextPath)
        )
          throw fail('Unrecognized course-list pagination.', 422);
        const next = new URL(nextPath, 'https://learn.bu.edu');
        if (
          next.username ||
          next.password ||
          next.hash ||
          next.origin !== 'https://learn.bu.edu' ||
          next.pathname !== membershipPath
        )
          throw fail('Unrecognized course-list pagination.', 422);
        nextPath = validateBlackboardReadPath(next.pathname + next.search, { subjectId });
        if (
          nextPath ===
          (more ? previous!.nextCatalogPath : membershipPath + '?expand=course&limit=50')
        )
          throw fail('Repeated course-list pagination.', 422, 'blackboard_paging_cycle');
      }
      await root.firestore.runTransaction(async (tx) => {
        const metadata = (await tx.get(root)).data();
        await guard(tx, root);
        if (
          !metadata ||
          metadata.ownerId !== account.uid ||
          metadata.workspaceId !== workspace.id ||
          metadata.deleted
        )
          throw fail('Workspace changed.', 409, 'workspace_changed');
        for (const course of catalog)
          tx.set(root.collection('blackboardCatalog').doc(hash(course.id)), {
            ownerId: account.uid,
            workspaceId: workspace.id,
            course,
            checkedAt,
            catalogEpoch: epoch,
          });
      });
      const configuration: Configuration = {
        ...connection.configuration,
        blackboard: {
          ...(previous?.mode ? { mode: previous.mode } : {}),
          ...(previous?.traversals ? { traversals: previous.traversals } : {}),
          selected: previous?.selected ?? [],
          nextCourseIndex: previous?.nextCourseIndex ?? 0,
          catalogIds: catalog.map((course) => course.id),
          catalogCheckedAt: checkedAt,
          catalogComplete: complete,
          catalogEpoch: epoch,
          catalogSubjectId: subjectId,
          ...(previous?.selectedSubjectId ? { selectedSubjectId: previous.selectedSubjectId } : {}),
          catalogQuery: query,
          ...(nextPath ? { nextCatalogPath: nextPath } : {}),
        },
      };
      return {
        value: {
          catalog: {
            courses: catalog,
            checkedAt,
            complete,
            query,
            ...(nextPath ? { nextCursor: 'available' } : {}),
          },
          selected: configuration.blackboard!.selected,
        },
        configuration,
        notice: 'Course list checked. Select courses before collecting material.',
      };
    },
  );
}

export async function selectBlackboardCourses(
  account: VerifiedAccount,
  ids: string[],
  mappings: Record<string, string> = {},
) {
  if (new Set(ids).size !== ids.length || Object.keys(mappings).some((id) => !ids.includes(id)))
    throw fail('Select each course once and map only selected courses.', 400);
  const lease = await acquireConnectionLease<Record<string, unknown>, Configuration>(
    account,
    'browser-blackboard',
    'select-courses',
    120_000,
    { recoverExpired: false },
  );
  try {
    const workspace = await readAccountWorkspace(account);
    if (!workspace) throw fail('Private workspace is unavailable.', 404);
    const rows = await catalogRows(
        account,
        workspace.id,
        ids,
        lease.connection.configuration.blackboard?.catalogEpoch,
      ),
      selected: BlackboardSelection[] = [],
      guard = connectionPublicationGuard(account, 'browser-blackboard', lease.leaseId);
    const updated = await updateAccountWorkspace(
      account,
      (state) => {
        for (const course of rows) {
          const mapped = mappings[course.id];
          let existing = mapped
            ? state.courses.find((item) => item.id === mapped)
            : state.courses.find((item) => item.id === `bb-${hash(course.id).slice(0, 24)}`);
          if (mapped && !existing)
            throw fail('Choose a course from this workspace.', 400, 'source_course_scope');
          if (!existing) {
            existing = {
              id: `bb-${hash(course.id).slice(0, 24)}`,
              code: course.code ?? course.title.slice(0, 50),
              title: course.title,
              instructor: '',
              color: 'blue',
              nextEvent: '',
              deadline: '',
            };
            state.courses.push(existing);
          }
          selected.push({ id: course.id, courseId: existing.id });
        }
        if (new Set(selected.map((item) => item.courseId)).size !== selected.length)
          throw fail('Different Blackboard courses need separate workspace mappings.', 400);
        const previous = lease.connection.configuration.blackboard?.selected ?? [];
        for (const choice of selected) {
          const prefix = 'blackboard:browser-blackboard:';
          const anchored = state.sources.filter((source) => {
            const key = source.provenance?.sourceKey;
            if (!key?.startsWith(prefix)) return false;
            return (
              key.startsWith(`${prefix}${choice.id}:`) ||
              (key.startsWith(`${prefix}https://`) &&
                parseBlackboardCourseUrl(key.slice(prefix.length))?.id === choice.id)
            );
          });
          if (anchored.some((source) => source.courseId !== choice.courseId))
            throw fail(
              'Collected material retains its original course mapping. Keep that mapping for this connection.',
              409,
              'source_mapping_conflict',
            );
        }
        withdrawBlackboardSources(state, (source) => {
          const key = source.provenance?.sourceKey,
            prefix = 'blackboard:browser-blackboard:';
          if (!key?.startsWith(prefix)) return false;
          const scoped = previous.some((choice) => key.startsWith(`${prefix}${choice.id}:`));
          const oldMappings = previous.filter((choice) => choice.courseId === source.courseId);
          const retained = scoped
            ? selected.some(
                (choice) =>
                  key.startsWith(`${prefix}${choice.id}:`) && source.courseId === choice.courseId,
              )
            : oldMappings.length > 0 &&
              oldMappings.every((old) =>
                selected.some((choice) => choice.id === old.id && choice.courseId === old.courseId),
              );
          return !retained;
        });
        return state;
      },
      workspace.revision,
      guard,
    );
    const previous = lease.connection.configuration.blackboard;
    const configuration: Configuration = {
      targets: selected.map((item) => ({
        courseId: item.courseId,
        url: canonicalBlackboardCourseUrl(item.id),
      })),
      blackboard: {
        mode: 'courses',
        selected,
        catalogIds: previous?.catalogIds ?? [],
        catalogCheckedAt: previous?.catalogCheckedAt ?? '',
        catalogComplete: previous?.catalogComplete ?? false,
        ...(previous?.catalogEpoch ? { catalogEpoch: previous.catalogEpoch } : {}),
        ...(previous?.catalogSubjectId
          ? {
              catalogSubjectId: previous.catalogSubjectId,
              selectedSubjectId: previous.catalogSubjectId,
            }
          : {}),
        traversals: Object.fromEntries(
          Object.entries(previous?.traversals ?? {}).filter(([id]) =>
            selected.some(
              (item) =>
                item.id === id &&
                previous?.selected.some((old) => old.id === id && old.courseId === item.courseId),
            ),
          ),
        ),
        ...(previous?.nextCatalogPath ? { nextCatalogPath: previous.nextCatalogPath } : {}),
        ...(previous?.catalogQuery ? { catalogQuery: previous.catalogQuery } : {}),
        nextCourseIndex: 0,
      },
    };
    if (
      !(await releaseConnectionLease(account, 'browser-blackboard', lease.leaseId, {
        configuration,
        notice: 'Selected courses saved. Refresh verifies access to their material.',
      }))
    )
      throw fail('Source selection changed. Retry.', 409, 'connection_changed');
    return { workspace: updated, ...(await blackboardStatus(account)) };
  } catch (error) {
    await releaseConnectionLease(account, 'browser-blackboard', lease.leaseId);
    throw error;
  }
}

/** One bounded slice of one selected course; subsequent runs rotate fairly and resume folders. */
export async function refreshBlackboardCourses(account: VerifiedAccount) {
  return withBrowserRead(
    account,
    'blackboard',
    (request) => isAllowedBlackboardRequest(request, [], 'collect'),
    async ({
      page,
      workspace,
      connection,
      guard,
      deadline,
      checkpointConfiguration,
      markPhase,
    }) => {
      const bb = connection.configuration.blackboard;
      if (bb?.mode !== 'courses' || !bb.selected.length)
        throw fail(
          'Choose at least one Blackboard course before refreshing.',
          400,
          'source_course_scope',
        );
      const index = Math.max(0, Math.trunc(bb.nextCourseIndex ?? 0)) % bb.selected.length,
        choice = bb.selected[index];
      if (!workspace.courses.some((course) => course.id === choice.courseId))
        throw fail(
          'The selected course is no longer in this workspace.',
          409,
          'source_course_scope',
        );
      let read: Awaited<ReturnType<typeof collectBlackboardMaterials>>;
      try {
        const identity = z
          .object({ id: z.string() })
          .safeParse(
            await readBlackboardJson(page.request, '/learn/api/v1/users/me', {}, deadline),
          );
        if (!bb.selectedSubjectId || !identity.success || identity.data.id !== bb.selectedSubjectId)
          throw fail(
            'Blackboard account changed. Rediscover and select courses again.',
            409,
            'browser_login_required',
          );
        read = await collectBlackboardMaterials(
          page,
          choice.id,
          bb.traversals?.[choice.id],
          deadline,
        );
      } catch (error) {
        await updateAccountWorkspace(
          account,
          (state) =>
            withdrawBlackboardSources(
              state,
              (source) =>
                !!source.provenance?.sourceKey.startsWith(
                  `blackboard:browser-blackboard:${choice.id}:`,
                ),
            ),
          undefined,
          guard,
        ).catch(() => undefined);
        // A course-specific unsupported route must not starve every later course. Expired login remains global.
        if ((error as { code?: string }).code !== 'browser_login_required')
          await checkpointConfiguration({
            ...connection.configuration,
            blackboard: { ...bb, nextCourseIndex: (index + 1) % bb.selected.length },
          });
        throw error;
      }
      markPhase?.('source-publication');
      const checkedAt = new Date().toISOString();
      let changedSourceIds: string[] = [];
      const updated = await updateAccountWorkspace(
        account,
        (state) => {
          const result = publishBlackboardRead(state, {
            providerCourseId: choice.id,
            courseId: choice.courseId,
            ...read,
            checkedAt,
          });
          changedSourceIds = result.changedSourceIds;
          return result.workspace;
        },
        workspace.revision,
        guard,
      );
      const traversals = { ...bb.traversals };
      if (read.cursor) traversals[choice.id] = read.cursor;
      else delete traversals[choice.id];
      const configuration: Configuration = {
        ...connection.configuration,
        blackboard: { ...bb, traversals, nextCourseIndex: (index + 1) % bb.selected.length },
      };
      const notice = `Read ${read.records.length} text item(s) from one selected course; ${changedSourceIds.length} changed. ${read.complete ? 'This supported text walk finished.' : 'More material remains; the next pass resumes it.'}${read.warnings ? ' Some items were unsupported or unreadable.' : ''} Files, images and external tools are not collected.`;
      // A successful slice does not claim the entire catalog or every selected course is current.
      return {
        value: { workspace: updated, changedSourceIds, notice },
        configuration,
        lastSuccessAt: checkedAt,
        status: 'connected' as const,
        notice,
      };
    },
  );
}
