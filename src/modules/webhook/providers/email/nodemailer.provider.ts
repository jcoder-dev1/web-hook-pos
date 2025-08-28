import nodemailer from 'nodemailer';

export interface EmailProvider {
  sendEmail(
    to: string[],
    subject: string,
    content: string,
    isHtml?: boolean,
  ): Promise<boolean>;
}

export class NodeMailerEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;
  // #Mail Configurations
  // Mailer_Name = Akshay Sutar
  // Mailer_UserName = akshaysutarwebsite@gmail.com
  // Mailer_Password = tdvruotizmlgvivc
  // Mailer_Port= 465
  // Mailer_Host= smtp.gmail.com
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com', // AWS SES SMTP endpoint or Gmail
      //port: Number(process.env.SMTP_PORT) || 587,
      //  host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true if port is 465
      auth: {
        // user: process.env.SMTP_USER, // e.g. SES SMTP username
        user: 'akshaysutarwebsite@gmail.com',
        // pass: process.env.SMTP_PASS, // e.g. SES SMTP password
        pass: 'tdvruotizmlgvivc',
      },
    });
  }

  async sendEmail(
    to: string[],
    subject: string,
    content: string,
    isHtml: boolean = true,
  ): Promise<any> {
    try {
      console.log(to, 'send to users....');
      const mailOptions = {
        //from: process.env.EMAIL_FROM || 'akshaysutarwebsite@gmail.com', // verified SES email
        from: 'akshaysutarwebsite@gmail.com', // verified SES email

        to: to.join(','),
        subject,
        [isHtml ? 'html' : 'text']: content,
      };

      const info = await this.transporter.sendMail(mailOptions);

      return info;
    } catch (error) {
      throw error;
    }
  }
}
