set -a
source ../.env
set +a
export COMPONENT=api
export AWS="aws --region $AWS_REGION --profile drfriendless --output text --no-cli-pager"

# upload code to S3
$AWS s3 cp $COMPONENT.zip s3://$DEPLOYMENT_BUCKET/
$AWS s3 cp lib/extstats-rust.zip s3://$DEPLOYMENT_BUCKET/
# deploy the stack
cdk deploy --profile drfriendless --require-approval never
success=$?
if [ $success -eq 0 ]; then
    echo CDK deployment of $COMPONENT stack succeeded
    cd lib
    npx ts-node --prefer-ts-exts ./post-stack.mts
else
    echo CDK deploy failed, not proceeding.
    exit 3
fi
date