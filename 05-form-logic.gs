// FILE: 05-form-logic.gs
function saveFormData(obj){
  ensurePastorsSheet_();
  ensureDelegatesSheet_();

  obj = obj || {};
  const email = String(obj.email || "").trim().toLowerCase();
  if (!email) throw new Error("Pastor Email is required.");

  const rowInfo = upsertPastorRow_(obj);
  replaceDelegatesForEmail_(email, obj.firstName || "", obj.lastName || "", obj.delegates || []);
  sendConfirmationEmail_(email, obj.firstName || "", obj.lastName || "", rowInfo.editLink, rowInfo.isNew);

  return { ok:true };
}
function sendConfirmationEmail_(email, firstName, lastName, editLink, isNew){
  if (!email) return;

  var fnln   = [firstName,lastName].filter(Boolean).join(" ").trim();
  var greet  = fnln ? ("Hi Pastor " + fnln + ",") : "Hi Pastor,";
  var subject = isNew ? "Your Perth Conference 2026 registration"
                      : "Your Perth Conference 2026 update";
  var intro   = isNew ? "Thanks for registering for Perth Conference 2026."
                      : "Your registration has been updated successfully.";

  var textBody = [
    greet, "",
    intro, "",
    "You can edit your registration any time:",
    editLink, "",
    "If you have any issues or questions please contact me on this email.", "",
    "Regards,",
    "Reneê Martin",
    "The Conference Registration Team"
  ].join("\n");

  var htmlBody =
    '<div style="font:14px Arial,Helvetica,sans-serif;color:#222">' +
      '<p>' + Util.escape(greet) + '</p>' +
      '<p>' + Util.escape(intro) + '</p>' +
      '<p>You can edit your registration any time:</p>' +
      '<p><a href="' + editLink + '" ' +
           'style="display:inline-block;background:#1a73e8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none" ' +
           'target="_blank">Open your registration</a></p>' +
      '<p>If you have any issues or questions please contact me on this email.</p>' +
      '<p>Regards,<br/>Reneê Martin<br/>The Conference Registration Team</p>' +
    '</div>';

  GmailApp.sendEmail(email, subject, textBody, {
    htmlBody: htmlBody
    // You can optionally set a friendly sender name if desired:
    // ,name: 'Reneê Martin – Conference Registration Team'
    // You could also set a reply-to explicitly (usually not needed):
    // ,replyTo: Session.getActiveUser().getEmail()
  });
}

