require "rubygems"
require "sprockets"

task :default => [:compile]

task :compile => [] do
  basepath = 'src'
  files = FileList.new
    .include("%s/tile5.js" % basepath)
    .include("%s/engines/*.js" % basepath)
    .include("%s/plugins/*.js" % basepath)
    .include("%s/style/*.js" % basepath)
    .sub(basepath, '')  
  
  files.each do |src|
    secretary = Sprockets::Secretary.new(
      :asset_root   => "dist",
      :load_path    => ["/development/projects/github/sidelab/", "/development/projects/github/", "build", "lib"],
      :source_files => ["src/%s" % src]
    )

    # Generate a Sprockets::Concatenation object from the source files
    concatenation = secretary.concatenation

    # Write the concatenation to disk
    concatenation.save_to("dist/%s" % src)
  end
end

task :minify => [:compile] do
  basepath = 'dist'
  files = FileList.new
    .include("%s/**/*.js" % basepath)
    .exclude(/min\.js$/)
    .sub(basepath, '')
    .sub('.js', '')
    
  files.each do |src|
    sh "java -jar /development/tools/javascript/closure/compiler.jar \
           --compilation_level SIMPLE_OPTIMIZATIONS \
           --js_output_file dist/%s.min.js \
           --js dist/%s.js" % [src, src]
  end
end

task :docs => [] do
  sh "perl /development/projects/github/sidelab/joDoc/joDoc \
       --output dist/docs \
       --markdown /development/tools/perl/Markdown.pl \
       --smartypants /development/tools/perl/SmartyPants.pl \
       --title \"Tile5 API Documentation\" \
       --template docs/html/template.html \
       docs/ src/"
end