#npx sls deploy

set -a
source ../.env
set +a
export COMPONENT=downloader
export AWS="aws --region $AWS_REGION --profile drfriendless --output text --no-cli-pager"

# upload code to S3
$AWS s3 cp $COMPONENT.zip s3://$DEPLOYMENT_BUCKET/

function define_lambda() {
  # https://docs.aws.amazon.com/cli/latest/reference/lambda/create-function.html
  $AWS lambda create-function --function-name $1 --handler $2 --runtime $RUNTIME --role $INVOKE_LAMBDAS --tags component=$COMPONENT --code S3Bucket=$DEPLOYMENT_BUCKET,S3Key=$COMPONENT.zip --publish
  if [ "$?" -ne 0 ]; then
    $AWS lambda update-function-code --function-name $1 --s3-bucket=$DEPLOYMENT_BUCKET --s3-key=$COMPONENT.zip --publish
  fi
}

define_lambda "downloader-processUserList" "functions.processUserList"

