import nodemailer from "nodemailer";
import User from "../app/models/userModel";
import bcryptjs from "bcryptjs";

export const sendEmail = async ({
    email,
    emailType,
    userId,
}: {
    email: string;
    emailType: "VERIFY" | "RESET";
    userId: string;
}) => {
    try {
        // Create a hashed token
        const hashedToken = await bcryptjs.hash(userId.toString(), 10);

        // Update user document with tokens and expiry
        if (emailType === "VERIFY") {
            await User.findByIdAndUpdate(userId, {
                verifyToken: hashedToken,
                verifyTokenExpiry: Date.now() + 3600000, // 1 hour expiry
            });
        } else if (emailType === "RESET") {
            await User.findByIdAndUpdate(userId, {
                forgotPasswordToken: hashedToken,
                forgotPasswordTokenExpiry: Date.now() + 3600000, // 1 hour expiry
            });
        }

        // Create email transporter using environment variables
        const transport = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.SMTP_USER, // Your email address from .env
                pass: process.env.SMTP_PASS, // Your app password from .env
            },
        });

        // Define email options
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject:
                emailType === "VERIFY" ? "Verify your email" : "Reset your password",
            html: `
        <p>
          Click <a href="${process.env.DOMAIN}/verifyemail?token=${hashedToken}">here</a> to ${emailType === "VERIFY" ? "verify your email" : "reset your password"
                }.
          <br>Or copy and paste the link below into your browser:
          <br>${process.env.DOMAIN}/verifyemail?token=${hashedToken}
        </p>
      `,
        };

        // Send the email
        const mailResponse = await transport.sendMail(mailOptions);
        return mailResponse;
    } catch (error: any) {
        console.error("Error sending email:", error);
        throw new Error("Unable to send email. Please try again later.");
    }
};
