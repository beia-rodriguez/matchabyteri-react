<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once "../../config/mail.php";
require_once "../../../vendor/autoload.php";

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

        $verifyLink =
            "http://localhost:5173/verify-email?token=" . urlencode($token);

        $mail->isHTML(true);

        $mail->Subject = "Verify your Matcha By Teri account";

        $mail->Body = "
            <div style='font-family:Arial,sans-serif'>
                <h2>Welcome to Matcha By Teri!</h2>

                <p>
                    Thank you for signing up.
                </p>

                <p>
                    Please verify your email address by clicking the button below:
                </p>

                <a href='$verifyLink'
                   style='
                        display:inline-block;
                        padding:12px 20px;
                        background:#6F4E37;
                        color:#fff;
                        text-decoration:none;
                        border-radius:6px;
                   '>
                    Verify Email
                </a>

                <p style='margin-top:20px'>
                    If you did not create this account,
                    you may safely ignore this email.
                </p>
            </div>
        ";

        $mail->AltBody =
            "Verify your email here: " . $verifyLink;

        $mail->send();

        return true;

    } catch (Exception $e) {

        error_log("Mailer Error: " . $mail->ErrorInfo);

        return false;
    }
}

function sendPasswordResetEmail($toEmail, $toName, $token)
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

        $resetLink = "http://localhost:5173/reset-password?token=" . urlencode($token);

        $mail->isHTML(true);
        $mail->Subject = "Reset your Matcha By Teri password";

        $mail->Body = "
            <div style='font-family:Arial,sans-serif'>
                <h2>Password Reset Request</h2>
                <p>Hello {$toName},</p>
                <p>Click the button below to reset your password:</p>

                <a href='{$resetLink}'
                   style='
                    display:inline-block;
                    padding:12px 20px;
                    background:#2f5d4e;
                    color:#fff;
                    text-decoration:none;
                    border-radius:6px;
                   '>
                    Reset Password
                </a>

                <p style='margin-top:20px'>
                    This link will expire in 1 hour.
                </p>

                <p>
                    If you did not request this, you can safely ignore this email.
                </p>
            </div>
        ";

        $mail->AltBody = "Reset your password here: " . $resetLink;

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("Password Reset Mailer Error: " . $mail->ErrorInfo);
        return false;
    }
}