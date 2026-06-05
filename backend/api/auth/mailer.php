<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . "/../../config/mail.php";
require_once __DIR__ . "/../../../vendor/autoload.php";

function app_url($path) {
    $base = defined("APP_URL") ? rtrim(APP_URL, "/") : "http://localhost:5173";
    return $base . $path;
}

function pesoMoney($value) {
    return "₱" . number_format((float) $value, 2);
}

function sendVerificationEmail($toEmail, $toName, $token)
{
    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = MAIL_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_USERNAME;
        $mail->Password   = MAIL_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = MAIL_PORT;

        $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
        $mail->addAddress($toEmail, $toName);

        $verifyLink = app_url("/verify-email?token=" . urlencode($token));

        $mail->isHTML(true);
        $mail->Subject = "Verify your Matcha By Teri account";

        $mail->Body = "
            <div style='font-family:Arial,sans-serif; background:#f6f7f6; padding:24px; color:#1f3b26;'>
                <div style='max-width:640px; margin:auto; background:#ffffff; border:1px solid #d8dfda; border-radius:18px; overflow:hidden;'>
                    <div style='background:#2f5a2b; color:#ffffff; padding:18px 22px;'>
                        <h2 style='margin:0; font-size:22px;'>Welcome to Matcha By Teri!</h2>
                        <p style='margin:6px 0 0; color:#edf7ef;'>Verify your account</p>
                    </div>

                    <div style='padding:22px;'>
                        <p style='margin:0 0 12px;'>Thank you for signing up.</p>

                        <p style='margin:0 0 16px;'>
                            Please verify your email address by clicking the button below:
                        </p>

                        <a href='{$verifyLink}'
                           style='
                                display:inline-block;
                                padding:12px 20px;
                                background:#2f5a2b;
                                color:#ffffff;
                                text-decoration:none;
                                border-radius:999px;
                                font-weight:700;
                           '>
                            Verify Email
                        </a>

                        <p style='margin:20px 0 0; color:#6b7a62; font-size:14px;'>
                            If you did not create this account, you may safely ignore this email.
                        </p>
                    </div>
                </div>
            </div>
        ";

        $mail->AltBody = "Verify your email here: " . $verifyLink;

        $mail->send();

        return true;
    } catch (Exception $e) {
        error_log("Verification Mailer Error: " . $mail->ErrorInfo);
        return false;
    }
}

function sendPasswordResetOtpEmail($toEmail, $toName, $otp)
{
    $safeName = htmlspecialchars($toName ?: "there", ENT_QUOTES, "UTF-8");
    $safeOtp = htmlspecialchars($otp, ENT_QUOTES, "UTF-8");

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = MAIL_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_USERNAME;
        $mail->Password   = MAIL_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = MAIL_PORT;

        $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
        $mail->addAddress($toEmail, $toName);

        $mail->isHTML(true);
        $mail->Subject = "Your Matcha By Teri password reset code";

        $mail->Body = "
            <div style='font-family:Arial,sans-serif; background:#f6f7f6; padding:24px; color:#1f3b26;'>
                <div style='max-width:640px; margin:auto; background:#ffffff; border:1px solid #d8dfda; border-radius:18px; overflow:hidden;'>
                    <div style='background:#2f5a2b; color:#ffffff; padding:18px 22px;'>
                        <h2 style='margin:0; font-size:22px;'>Password Reset Code</h2>
                        <p style='margin:6px 0 0; color:#edf7ef;'>Matcha By Teri</p>
                    </div>

                    <div style='padding:22px;'>
                        <p style='margin:0 0 12px;'>Hello {$safeName},</p>

                        <p style='margin:0 0 16px;'>Use this 6-digit code to reset your password:</p>

                        <div style='
                            display:inline-block;
                            padding:14px 22px;
                            background:#f3f7f4;
                            border:1px solid #d8dfda;
                            border-radius:10px;
                            color:#2f5a2b;
                            font-size:28px;
                            font-weight:800;
                            letter-spacing:6px;
                        '>
                            {$safeOtp}
                        </div>

                        <p style='margin:20px 0 0; color:#6b7a62;'>
                            This code will expire in 10 minutes.
                        </p>

                        <p style='margin:10px 0 0; color:#6b7a62;'>
                            If you did not request this, you can safely ignore this email.
                        </p>
                    </div>
                </div>
            </div>
        ";

        $mail->AltBody =
            "Your Matcha By Teri password reset code is: " . $otp .
            "\nThis code will expire in 10 minutes.";

        $mail->send();

        return true;
    } catch (Exception $e) {
        error_log("Password Reset OTP Mailer Error: " . $mail->ErrorInfo);
        return false;
    }
}

function sendPasswordResetEmail($toEmail, $toName, $tokenOrOtp)
{
    return sendPasswordResetOtpEmail($toEmail, $toName, $tokenOrOtp);
}

function sendRefundDecisionEmail($toEmail, $toName, $refundData, $decision, $adminNotes = "", $attachmentPath = null, $attachmentName = null)
{
    if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        error_log("Refund Mailer Error: Invalid email address.");
        return false;
    }

    $decision = strtolower(trim((string) $decision));

    if (!in_array($decision, ["approved", "rejected"], true)) {
        error_log("Refund Mailer Error: Invalid refund decision.");
        return false;
    }

    $safeName = htmlspecialchars($toName ?: "Customer", ENT_QUOTES, "UTF-8");

    $amountPaid = pesoMoney($refundData["amount_paid"] ?? 0);
    $refundableAmount = pesoMoney($refundData["refundable_amount"] ?? 0);

    $refundType = (string) ($refundData["refund_type"] ?? "");

    $transactionType =
        $refundType === "workshop_registration"
            ? "Public Workshop Registration"
            : "Booking";

    $referenceLabel =
        $refundType === "workshop_registration"
            ? "Registration ID"
            : "Booking ID";

    $referenceValue =
        $refundType === "workshop_registration"
            ? ($refundData["registration_id"] ?? "N/A")
            : ($refundData["booking_id"] ?? "N/A");

    $customerNumber = $refundData["customer_phone_number"] ?? "N/A";
    $gcashName = $refundData["customer_gcash_name"] ?? "N/A";

    if (!$customerNumber) {
        $customerNumber = "N/A";
    }

    if (!$gcashName) {
        $gcashName = "N/A";
    }

    $safeTransactionType = htmlspecialchars($transactionType, ENT_QUOTES, "UTF-8");
    $safeReferenceLabel = htmlspecialchars($referenceLabel, ENT_QUOTES, "UTF-8");
    $safeReferenceValue = htmlspecialchars((string) $referenceValue, ENT_QUOTES, "UTF-8");
    $safeCustomerNumber = htmlspecialchars((string) $customerNumber, ENT_QUOTES, "UTF-8");
    $safeGcashName = htmlspecialchars((string) $gcashName, ENT_QUOTES, "UTF-8");
    $safeReason = nl2br(htmlspecialchars($refundData["reason"] ?? "No reason provided.", ENT_QUOTES, "UTF-8"));
    $safeAdminNotes = nl2br(htmlspecialchars($adminNotes ?: "No additional notes.", ENT_QUOTES, "UTF-8"));

    $statusText = $decision === "approved" ? "Approved" : "Rejected";
    $statusColor = $decision === "approved" ? "#145020" : "#b91c1c";

    if ($decision === "approved") {
        $mainMessage = "
            <p style='margin:0 0 12px;'>
                Your refund request has been
                <strong style='color:{$statusColor};'>approved</strong>.
            </p>

            <p style='margin:0 0 12px;'>
                Based on the refund policy, you are eligible to receive
                <strong>{$refundableAmount}</strong>, which is 50% of the paid amount.
            </p>

            <p style='margin:0 0 12px; color:#6b7a62;'>
                Please wait for the admin or business owner to process the actual refund transaction.
            </p>
        ";
    } else {
        $mainMessage = "
            <p style='margin:0 0 12px;'>
                Your refund request has been
                <strong style='color:{$statusColor};'>rejected</strong>.
            </p>

            <p style='margin:0 0 12px;'>
                No refund money will be issued for this transaction.
            </p>
        ";
    }

    $attachmentNotice = "";

    if ($attachmentPath && file_exists($attachmentPath)) {
        $attachmentNotice = "
            <p style='margin:16px 0 0; color:#6b7a62; font-size:14px;'>
                The admin attached a file with this email for your reference.
            </p>
        ";
    }

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = MAIL_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_USERNAME;
        $mail->Password   = MAIL_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = MAIL_PORT;

        $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
        $mail->addAddress($toEmail, $toName ?: "Customer");

        if ($attachmentPath && file_exists($attachmentPath)) {
            $mail->addAttachment($attachmentPath, $attachmentName ?: basename($attachmentPath));
        }

        $mail->isHTML(true);
        $mail->Subject = "Refund Request {$statusText} - Matcha By Teri";

        $mail->Body = "
            <div style='font-family:Arial,sans-serif; background:#f6f7f6; padding:24px; color:#1f3b26;'>
                <div style='max-width:640px; margin:auto; background:#ffffff; border:1px solid #d8dfda; border-radius:18px; overflow:hidden;'>
                    <div style='background:#2f5a2b; color:#ffffff; padding:18px 22px;'>
                        <h2 style='margin:0; font-size:22px;'>Refund Request {$statusText}</h2>
                        <p style='margin:6px 0 0; color:#edf7ef;'>Matcha By Teri</p>
                    </div>

                    <div style='padding:22px;'>
                        <p style='margin:0 0 12px;'>Hello {$safeName},</p>

                        {$mainMessage}

                        <div style='background:#f6f7f6; border:1px solid #d8dfda; border-radius:14px; padding:14px; margin:16px 0;'>
                            <p style='margin:0 0 8px;'><strong>Transaction Type:</strong> {$safeTransactionType}</p>
                            <p style='margin:0 0 8px;'><strong>{$safeReferenceLabel}:</strong> {$safeReferenceValue}</p>
                            <p style='margin:0 0 8px;'><strong>Customer Number:</strong> {$safeCustomerNumber}</p>
                            <p style='margin:0 0 8px;'><strong>GCash Name:</strong> {$safeGcashName}</p>
                            <p style='margin:0 0 8px;'><strong>Amount Paid:</strong> {$amountPaid}</p>
                            <p style='margin:0 0 8px;'><strong>Refund Policy:</strong> 50% refund</p>
                            <p style='margin:0;'><strong>Refund Amount:</strong> {$refundableAmount}</p>
                        </div>

                        <div style='background:#fffdf0; border:1px solid #f0d77a; border-radius:14px; padding:14px; margin:16px 0;'>
                            <p style='margin:0 0 8px;'><strong>Your Refund Reason:</strong></p>
                            <p style='margin:0;'>{$safeReason}</p>
                        </div>

                        <div style='background:#ffffff; border:1px solid #d8dfda; border-radius:14px; padding:14px; margin:16px 0;'>
                            <p style='margin:0 0 8px;'><strong>Admin Notes:</strong></p>
                            <p style='margin:0;'>{$safeAdminNotes}</p>
                        </div>

                        {$attachmentNotice}

                        <p style='margin:16px 0 0; color:#6b7a62; font-size:14px;'>
                            Thank you,<br>
                            Matcha By Teri
                        </p>
                    </div>
                </div>
            </div>
        ";

        $plainBody = "Hello " . ($toName ?: "Customer") . ",\n\n";
        $plainBody .= "Your refund request has been " . strtolower($statusText) . ".\n\n";
        $plainBody .= "Transaction Type: " . $transactionType . "\n";
        $plainBody .= $referenceLabel . ": " . $referenceValue . "\n";
        $plainBody .= "Customer Number: " . $customerNumber . "\n";
        $plainBody .= "GCash Name: " . $gcashName . "\n";
        $plainBody .= "Amount Paid: " . $amountPaid . "\n";
        $plainBody .= "Refund Policy: 50% refund\n";
        $plainBody .= "Refund Amount: " . $refundableAmount . "\n\n";

        if ($decision === "approved") {
            $plainBody .= "Please wait for the admin or business owner to process the actual refund transaction.\n\n";
        } else {
            $plainBody .= "No refund money will be issued for this transaction.\n\n";
        }

        $plainBody .= "Admin Notes: " . ($adminNotes ?: "No additional notes.") . "\n\n";

        if ($attachmentPath && file_exists($attachmentPath)) {
            $plainBody .= "The admin attached a file with this email for your reference.\n\n";
        }

        $plainBody .= "Thank you,\nMatcha By Teri";

        $mail->AltBody = $plainBody;

        $mail->send();

        return true;
    } catch (Exception $e) {
        error_log("Refund Mailer Error: " . $mail->ErrorInfo);
        return false;
    }
}