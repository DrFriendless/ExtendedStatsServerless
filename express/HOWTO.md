# HOW TO BUILD

./package.sh

# HOW TO DEPLOY

scp -i ~/.ssh/extstats-express.pem extstats-express.zip ubuntu@eb2.drfriendless.com:/opt/express

Then run unpackage.sh on the server as described below.

# HOW TO CREATE THE EXPRESS SERVER

Create an EC2 instance from the extstats-express AMI. Put it in a public subnet and give it a public IP address.

Edit the security group to add SSH access for yourself, and HTTP access from anywhere.

Start the instance. In Route 53, point eb.drfriendless.com to the instance's address. SSH into the instance to add it to
your known_hosts file. Run deploy.sh to install the extstats-express software on the server.

SSH into the server and run

    sudo /opt/express/unpackage.sh


# HOW TO CREATE THE EXPRESS AMI

Launch an EC2 with the correct Ubuntu.

    sudo apt-get install nodejs
    npm
    express

    sudo apt-get install unzip
    sudo npm install -g pm2

Stop the instance. Create an image from the stopped instance.

# HOW TO RESTART THE SERVER

Log in to the server.

    cd /opt/express
    sudo pm2 start dist/server.js -u root