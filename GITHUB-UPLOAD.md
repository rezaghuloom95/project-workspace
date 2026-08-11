# Uploading Project Workspace to GitHub

This project is prepared for GitHub. Use a **Private** repository while the product is commercial and its licensing terms have not been finalized.

## One-time setup on your Mac

1. Create an account at <https://github.com/signup> and verify your email address.
2. Download GitHub Desktop from <https://desktop.github.com/>.
3. Open the downloaded ZIP, move **GitHub Desktop** to Applications, and launch it.
4. Sign in: **GitHub Desktop > Settings > Accounts > Sign Into GitHub.com**.

## Publish this project

1. In GitHub Desktop, select **File > Add Local Repository**.
2. Click **Choose** and select this folder:

   `/Users/redhaghuloom/Documents/Codex/Marketing Planner/General Project Manager`

3. Click **Add Repository**.
4. In the lower-left Summary field, enter:

   `Initial release of Project Workspace`

5. Click **Commit to main**.
6. At the top, click **Publish repository**.
7. Use these details:

   - Name: `project-workspace`
   - Description: `A self-hosted, white-label project management workspace for teams.`
   - Keep this code private: **Selected**
   - Organization: **None** (unless you created a GitHub organization)

8. Click **Publish Repository**.
9. Select **Repository > View on GitHub** to confirm that the files are online.

## Upload later changes

1. Open GitHub Desktop and select **Project Workspace**.
2. Review the changed-file list.
3. Enter a short Summary, such as `Improve reminder settings`.
4. Click **Commit to main**.
5. Click **Push origin**.

## Files intentionally excluded

The `.gitignore` file prevents these private or generated files from being published:

- `.env` files
- installed dependencies (`node_modules`)
- build output (`dist`)
- generated Hostinger package folder and source ZIP archives
- live JSON database and backup
- SMTP email configuration
- uploaded customer logos and branding

Never force-add those files. The exact `Hostinger-Upload-Project-Workspace.zip` installation package is the only ZIP intentionally included so the README download link works.

## Recommended repository details

- Visibility: **Private**
- Default branch: `main`
- Suggested topics: `project-management`, `task-management`, `self-hosted`, `php`, `react`, `vite`, `pwa`, `white-label`
- License: do not select an open-source license until you decide how customers may use, modify, and redistribute the product

Official help:

- <https://docs.github.com/en/desktop/overview/getting-started-with-github-desktop>
- <https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop>
