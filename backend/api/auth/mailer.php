<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once "../../config/mail.php";
require_once "../../../vendor/autoload.php";

function app_url($path) {
    $base = defined("APP_URL") ? rtrim(APP_URL, "/") : "http://localhost:5173";
    return $base . $path;
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
            <div style='font-family:Arial,sans-serif; color:#1f2937'>
                <h2>Password Reset Code</h2>
                <p>Hello {$safeName},</p>
                <p>Use this 6-digit code to reset your password:</p>

                <div style='
                    display:inline-block;
                    padding:14px 22px;
                    background:#f3f7f4;
                    border:1px solid #d8dfda;
                    border-radius:10px;
                    color:#2f5d4e;
                    font-size:28px;
                    font-weight:800;
                    letter-spacing:6px;
                '>
                    {$safeOtp}
                </div>

                <p style='margin-top:20px'>
                    This code will expire in 10 minutes.
                </p>

                <p>
                    If you did not request this, you can safely ignore this email.
                </p>
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

/*
  Backward-compatible function name.
  If another old file still calls sendPasswordResetEmail, it will send an OTP email
  instead of a reset link when passed an OTP.
*/
function sendPasswordResetEmail($toEmail, $toName, $tokenOrOtp)
{
    return sendPasswordResetOtpEmail($toEmail, $toName, $tokenOrOtp);
}
