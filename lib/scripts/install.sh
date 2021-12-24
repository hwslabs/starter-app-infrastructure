#! /bin/bash

cd /home/ec2-user

# Code deploy agent only installs when /usr/bin/ruby exists and is version 2.3.8
# Install rbenv, ruby version 2.3.8 and create a symlink at /usr/bin/ruby
git clone git://github.com/sstephenson/rbenv.git ~/.rbenv
echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(rbenv init -)"' >> ~/.bashrc
source ~/.bashrc
git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build
yum install -y openssl-devel readline-devel
rbenv install 2.3.8
rbenv global 2.3.8
ln -s /root/.rbenv/shims/ruby /usr/bin/ruby

# Download aws-code-deploy agent from s3, install and start
aws s3 cp s3://aws-codedeploy-ap-south-1/latest/install . --region ap-south-1;
chmod +x install;
./install auto;
service codedeploy-agent start

yum -y update
yum install -y ruby
yum install -y aws-cli
amazon-linux-extras install -y postgresql13
yum install -y postgresql-devel

yum install -y htop nc tar gzip git procps
yum install -y https://s3.ap-south-1.amazonaws.com/hypto-installers/wkhtmltox.rpm
yum install -y libpng12 zlib-devel gcc-c++ make

# Install node, yarn, jq and aws-cdk
curl -sL https://rpm.nodesource.com/setup_16.x | bash
yum install -y nodejs
npm install --global yarn
npm install --global ts-node
npm install --global aws-cdk
yum install -y jq
yum install -y unzip

# Install AWS CLI and configure
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

amazon-linux-extras install -y ruby3.0
yum install -y ruby-devel redhat-rpm-config
gem install bundler -v 2.2.31

## Switch ruby version to 3.0.3 for our application
rbenv install 3.0.2
rbenv global 3.0.2
mv /usr/bin/ruby /usr/bin/ruby_2.3.8
ln -s /root/.rbenv/shims/ruby /usr/bin/ruby

# Install and start the docker service
yum install -y docker
systemctl enable docker.service
systemctl start docker.service

# Push environment variables to /etc/profile
echo "export RAILS_ENV=_RAILS_ENV" >> /etc/profile
echo "export REDIS_HOST=_REDIS_HOST" >> /etc/profile
echo "export DATABASE_URL=_DATABASE_URL" >> /etc/profile
echo "export SECRET_KEY_BASE=_SECRET_KEY_BASE" >> /etc/profile
echo "export AWS_ACCESS_KEY_ID=_AWS_ACCESS_KEY_ID" >> /etc/profile
echo "export AWS_SECRET_ACCESS_KEY=_AWS_SECRET_ACCESS_KEY" >> /etc/profile
echo "export AWS_DEFAULT_REGION=ap-south-1" >> /etc/profile
echo "export CDK_DEFAULT_ACCOUNT=_CDK_DEFAULT_ACCOUNT" >> /etc/profile
echo "export CDK_DEFAULT_REGION=ap-south-1" >> /etc/profile
echo "export AWS_DEFAULT_OUTPUT=json" >> /etc/profile
