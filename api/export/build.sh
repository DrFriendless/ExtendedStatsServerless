
mkdir dist
rm dist/*
cp package.json ./dist
cd dist
npm pack
cp *.tgz ~/projects/repo
mv *.tgz ..