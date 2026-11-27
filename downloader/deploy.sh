set -a
source ../.env
set +a
export COMPONENT=downloader
export AWS="aws --region $AWS_REGION --profile drfriendless --output text --no-cli-pager"

# upload code to S3
$AWS s3 cp $COMPONENT.zip s3://$DEPLOYMENT_BUCKET/

# deploy the stack
cdk deploy --profile drfriendless --require-approval never
success=$?
if [ $success -eq 0 ]; then
    # tell the Lambdas to refresh from their code source, because CloudFront is too special to do that.
    cd lib
    npx ts-node --prefer-ts-exts ./post-stack.mts
else
    echo Deploy failed, not running post-stack.
fi
date