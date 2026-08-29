# Heritg Family Tree MVP Design

## Objective

Recreate the visual language and core family-tree creation experience of `heritg.us` as a local-first web application. The MVP must let users create and manage useful family trees without an account or backend. Collaboration, shared links, accounts, and cross-device synchronization are reserved for a later release.

## Product Scope

### Included in the MVP

- Create, rename, duplicate, switch between, export, import, and delete multiple family trees.
- Create, edit, and delete people with a name, photo, gender, birth date, death date, and notes.
- Add and edit parent-child and partner relationships.
- Add a parent, partner, child, or sibling from a selected person.
- Automatically arrange person cards and relationship lines on an interactive canvas.
- Pan, zoom, fit, select, and focus people on the canvas.
- Search and browse everyone in the active tree.
- Limit visible branch depth.
- Save data and workspace preferences automatically on the current device.
- Protect visible personal details using a local privacy mode.
- Import and export versioned `.heritg` files.
- Match the reference site's desktop, tablet, and mobile presentation as closely as practical.

### Deferred to the Collaboration Release

- User accounts and authentication.
- Shared links and access permissions.
- Real-time or asynchronous multi-user editing.
- Cross-device synchronization and cloud backups.
- Paid Family+ behavior.

The Share and Family+ controls remain visible for visual fidelity, but clearly communicate that they are planned for the collaboration release. They must not imply that data has been uploaded or shared.

## Technical Direction

Use Next.js with the App Router, TypeScript, and a token-driven CSS system. The application shell and metadata can be server-rendered, while the tree editor is an isolated client-side workspace.

The canvas uses a custom React and SVG implementation rather than a general graph-editor library. Person cards and interaction surfaces remain accessible HTML where appropriate; SVG renders relationship paths and canvas decoration. This gives the implementation direct control over the reference site's visual behavior without shipping an unnecessarily large dependency.

No backend, authentication system, database service, or global state library is required for the MVP.

## Domain Model

### `FamilyTree`

- `id: string`
- `name: string`
- `createdAt: string`
- `updatedAt: string`
- `rootPersonId: string | null`
- `people: Person[]`
- `relationships: Relationship[]`
- `preferences: TreePreferences`

### `Person`

- `id: string`
- `firstName: string`
- `middleName: string`
- `lastName: string`
- `displayName: string`
- `gender: "female" | "male" | "nonbinary" | "unspecified"`
- `birthDate: string | null`
- `deathDate: string | null`
- `photo: StoredPhoto | null`
- `notes: string`
- `createdAt: string`
- `updatedAt: string`

### `Relationship`

Relationships use explicit records instead of embedding children or partners inside a person.

- `id: string`
- `type: "parent-child" | "partner"`
- `fromPersonId: string`
- `toPersonId: string`
- `createdAt: string`

For a `parent-child` relationship, `fromPersonId` is the parent and `toPersonId` is the child. Partner relationships are treated as unordered by domain operations even though their serialized representation uses two fields.

### `TreePreferences`

- `branchDepth: number | null`
- `privacyEnabled: boolean`
- `viewport: { x: number; y: number; zoom: number }`
- `canvasControlsVisible: boolean`

### `WorkspaceState`

- `schemaVersion: number`
- `activeTreeId: string`
- `trees: FamilyTree[]`
- `lastSavedAt: string`

## Persistence and Data Safety

The application stores its workspace locally through a repository interface so the storage technology can change without affecting UI or domain operations. IndexedDB is preferred for tree data and compressed photos because it provides more capacity and better structured storage than `localStorage`. Small UI preferences may use `localStorage`.

Every accepted domain change triggers a debounced autosave. Before replacing the current persisted workspace, the repository retains a last-known-good snapshot. If the primary record cannot be decoded, the application offers to restore the backup or start a new local workspace.

Photos are resized and compressed in the browser before persistence. When the browser refuses a write because storage is full, the user receives an actionable error and an option to export the current tree as a backup.

Export files use a versioned JSON envelope with the `.heritg` extension. Import validates the schema version, required fields, identifiers, duplicate records, dangling references, and invalid relationship cycles before replacing or adding data. Imported data never partially mutates the active workspace.

## Domain Rules

- Person and relationship identifiers are unique within a tree.
- A person cannot be their own parent, child, or partner.
- Duplicate partner and parent-child relationships are rejected.
- Parent-child relationships cannot introduce ancestry cycles.
- Deleting a person requires confirmation and removes their associated relationships atomically.
- Deleting a tree requires confirmation and is unavailable when it is the only empty initial tree; that tree can instead be reset.
- Adding a sibling creates the sibling and connects it to the selected person's known parent or parents. If the selected person has no known parent, the UI asks the user to add or select a shared parent first.
- When a visible branch-depth limit hides a newly added person, the application temporarily reveals and focuses that person so the action has an observable result.

## Layout Engine and Canvas

The layout engine is a pure module that receives people, relationships, a root person, and an optional depth limit. It returns stable person positions, partner-group bounds, and SVG relationship paths.

The engine organizes generations vertically and family groups horizontally. Partners sit on the same generation. Children are centered beneath their parent or partner group. Stable ordering uses existing positions and deterministic identifiers to reduce large shifts after edits.

The canvas owns viewport pan and zoom state. It supports pointer dragging, wheel or trackpad zooming, zoom buttons, fit-to-tree, focusing a selected person, and keyboard-operable alternatives. Zoom is clamped to a useful range. The canvas does not trap keyboard focus or prevent ordinary page accessibility behavior.

## User Experience

### First Run

The initial workspace contains one empty tree named `My Family Tree`. The center of the canvas mirrors the reference site's “Start with anyone” empty state with actions to add any family member, open or import a tree, and learn the canvas.

### Adding and Editing People

Adding the first person opens the person editor. A name is required; all other information is optional. Saving places and focuses the first card on the canvas.

Selecting a person opens a detail panel with actions to edit the person or add a parent, partner, child, or sibling. Relationship-aware add flows prefill the intended connection. Layout changes animate subtly and preserve the user's viewport unless the new person would otherwise be off screen.

### Tree Management

The left sidebar contains branding, tree search, the user's tree list, New tree, Import file, Family+, and privacy information. Each tree exposes rename, duplicate, export, and delete actions. Switching trees restores that tree's viewport.

### Search and Navigation

“All people” opens a searchable directory. Selecting a result closes or minimizes the directory, expands the necessary branch depth, selects the person, and centers their card.

### Privacy

Privacy mode is a local presentation control. When active, dates, notes, and photos are obscured until the user deliberately reveals or disables protection. Names remain visible so the tree stays navigable. The interface explicitly states that protection applies on the current device and is not encryption or cloud access control.

### Deferred Controls

Share and Family+ open a compact explanatory dialog stating that collaboration and device sync are planned for a later release. The dialog contains no fake success flow.

## Visual System

The implementation follows the reference site's restrained, warm archival aesthetic:

- An off-white canvas and cream surfaces.
- Deep brown primary text and muted taupe secondary text.
- Warm tan borders and brand accents.
- A plum Family+ accent.
- Compact floating controls with subtle shadows and rounded corners.
- A characterful serif or humanist display treatment paired with a highly readable UI face, chosen after final font inspection of the reference.

Colors, typography, spacing, radii, shadows, container measurements, control sizes, and breakpoints are represented by CSS custom properties. Repeated visual values are not copied as unrelated literals across components.

Motion reproduces visible reference behavior only: short fades, slides, selection emphasis, viewport movement, and layout transitions. All motion respects `prefers-reduced-motion`.

## Responsive Behavior

### Desktop: 1024 px and wider

- Floating tree switcher and title controls at the top left.
- Family+ and Share actions at the top right.
- Vertical canvas controls at the right edge.
- Privacy, help, and canvas visibility controls along the bottom edges.
- Sidebar overlays the canvas and does not resize the family layout.
- Person detail editing uses a right-side panel or appropriately sized modal.

### Tablet: 768–1023 px

- Reduced control spacing and narrower panels.
- Secondary labels collapse where the icon and accessible name remain sufficient.
- Editor panels may cover more of the canvas but preserve an obvious close action.

### Mobile: below 768 px

- A compact top bar replaces the desktop header grouping.
- Sidebar, directory, settings, and person editor use full-height drawers.
- Frequently used zoom and add actions move to reachable bottom controls.
- Canvas remains pannable with touch and preserves readable person-card dimensions rather than shrinking the desktop view indiscriminately.
- Dialogs fit 360, 375, and 390 px viewports without horizontal scrolling.

## Component Boundaries

- `AppShell`: global layout, active workspace state, and top-level dialogs.
- `AppHeader`: tree title, desktop actions, and compact mobile navigation.
- `TreeSidebar`: tree search, tree list, create/import, and per-tree actions.
- `FamilyCanvas`: viewport gestures, selection, focus, and render composition.
- `PersonCard`: accessible person summary and selection state.
- `RelationshipLines`: SVG paths computed by the layout engine.
- `PersonDetailsPanel`: selected-person information and relationship actions.
- `PersonEditor`: validated create and edit form with photo processing.
- `PeopleDirectory`: searchable people list and focus behavior.
- `CanvasControls`: branch depth, zoom, fit, and control visibility.
- `SettingsPanel`: workspace display and privacy preferences.
- `ImportExportDialog`: safe import validation and explicit export actions.
- `ConfirmDialog`: destructive-action confirmation.
- `DeferredFeatureDialog`: honest Share and Family+ release messaging.
- `ui/*`: focused button, input, icon-button, modal, drawer, menu, tooltip, and status primitives.

Business rules remain in domain modules rather than UI event handlers. Storage access remains behind the repository interface. The layout engine has no browser or React dependency.

## Accessibility

- Use semantic landmarks and a correct heading hierarchy.
- Give every icon-only control an accessible name and visible focus state.
- Support keyboard use for menus, dialogs, drawers, forms, directories, and person selection.
- Trap and restore focus correctly in modal interfaces.
- Provide text equivalents for visual relationship actions.
- Maintain sufficient text and control contrast.
- Avoid relying on color alone for gender, selection, errors, or privacy status.
- Provide the people directory as an accessible alternative to spatial canvas navigation.

## Error Handling

- Field errors appear next to their inputs without discarding entered data.
- Invalid relationships explain which rule prevented the change.
- Import errors identify the unsupported or malformed part without exposing raw stack traces.
- Storage errors preserve in-memory data and offer export before retrying.
- Unexpected rendering errors show a recoverable workspace message and preserve local data.
- Empty search results and depth-filtered results explain how to proceed.

## SEO and Metadata

The application uses Next.js metadata for a concise title and description, canonical root URL when a deployment URL is known, favicon, and Open Graph metadata. The app shell includes semantic landmarks even though the primary experience is interactive and local-first.

## Testing Strategy

### Unit Tests

- Person and relationship creation, updates, and deletion.
- Duplicate and self-relationship rejection.
- Ancestry cycle prevention.
- Sibling creation rules.
- Deterministic layout positions and partner/child grouping.
- Depth filtering and focus reveal behavior.
- Import schema validation, migration boundaries, and round-trip export.
- Repository save, load, backup, and recovery behavior.

### Component Tests

- Required person fields and preserved form values on errors.
- Sidebar create, rename, duplicate, switch, and delete flows.
- People search and canvas focus callbacks.
- Privacy masking and explicit reveal behavior.
- Destructive confirmation and deferred-feature messaging.
- Keyboard navigation and focus restoration for overlays.

### End-to-End Tests

- Start from an empty workspace and create a three-generation tree.
- Add and edit partner, parent, child, and sibling relationships.
- Reload and verify tree data and viewport persistence.
- Export a tree, import it into a clean workspace, and compare its data.
- Search for a person and focus their card.
- Exercise primary interactions at a desktop viewport and at 390 px mobile width.
- Verify that Share and Family+ clearly remain deferred.

## Verification and Acceptance

The implementation is complete when:

- TypeScript, lint, unit tests, component tests, end-to-end tests, and the production build pass.
- Primary flows produce no browser console errors.
- Navigation and all MVP controls work with mouse, keyboard, and touch-appropriate interactions.
- Data survives reload and a validated export/import round trip.
- Desktop screenshots at 1440, 1280, and 1024 px and mobile screenshots at 390, 375, and 360 px have been compared against the reference and refined for spacing, typography, control sizing, alignment, and responsive behavior.
- The README documents installation, development, build, testing, project structure, local data behavior, and the collaboration-release boundary.

## Known Product Boundary

The MVP stores personal family information only on the current browser profile. It does not provide encryption, remote backups, collaboration, account recovery, or cross-device access. The interface must communicate this boundary wherever a user could otherwise reasonably infer cloud protection or sharing.
