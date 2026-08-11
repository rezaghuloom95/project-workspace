# Hostinger upload guide

## First installation

1. In Hostinger hPanel, create the domain, subdomain, or subfolder where the system will live.
2. Open **File Manager** and enter that site folder. It may be `public_html`, a subdomain folder, or your chosen subfolder.
3. Upload `Hostinger-Upload-Project-Workspace.zip` into that folder.
4. Extract the ZIP there. The folder should directly contain `index.html`, `.htaccess`, `api`, `assets`, `fonts`, `branding`, and `storage`.
5. In hPanel, select **PHP 8.1 or newer** for the site.
6. Visit `https://your-domain.example/api/health`. A successful installation returns JSON containing `"ok": true`.
7. Open the normal website address and sign in with:
   - Username: `admin`
   - Password: `Admin@123`
8. Complete the required first-time screen. Enter the administrator’s real name, organization name, email, and a new password of at least 12 characters. The temporary login stops working immediately.
9. Open **Settings** to change the product name, workspace name, colors, three logo versions, timezone, week start, time format, categories, and email settings.

## Email reminders

In **Settings → Email notifications**, enter the SMTP host, port, mailbox username, sender address, reply-to address, and mailbox password. Hostinger mailboxes normally use `smtp.hostinger.com`, port `465`, and SSL.

Then create one PHP cron job in hPanel:

- Command: select the uploaded `api/cron-email.php` file.
- Minute: every 5 minutes (`*/5`)
- Hour: every hour (`*`)
- Day: every day (`*`)
- Month: every month (`*`)
- Weekday: every weekday (`*`)

The five-minute cron check does not send the same reminder every five minutes. It only sends new assignment notices and the eligible 3, 2, 1, 0-day or overdue reminder once.

## Future updates

Before replacing files, download a backup of the `storage` folder. Upload the new package files but do not overwrite or delete the live `storage` folder, because it contains users, projects, settings, logos, and protected SMTP configuration.

The system is self-contained on the same hosting account. It does not need an external database or application server. Files are stored on external platforms and connected as links, so large uploads are not accepted by the workspace.
