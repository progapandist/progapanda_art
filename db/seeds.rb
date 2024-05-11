require "thor"
# Specify the directory path where the files are located
ART_SOURCE_DIR = "/Users/progapandist/progapanda_art_sources"

class Seeder < Thor
  include Thor::Actions

  desc "go_seed", "Seed the database with works"
  def go_seed
    Work.destroy_all

    # Get an array of filenames from the specified directory
    slugs = Dir.entries(ART_SOURCE_DIR).select { |f| File.file?(File.join(ART_SOURCE_DIR, f)) && !f.start_with?(".") }

    slugs.each do |slug|
      # Remove file extension from the filename to use as the slug
      slug_name = File.basename(slug, ".*")
      say "Processing #{slug_name}...", :green

      ActiveRecord::Base.transaction do
        m = Work.find_or_create_by!(slug: slug_name)
        m.update!(description: "A #{slug_name.humanize} model.")
      end
    end
  end

  Seeder.new.go_seed

  artworks = Rails.application.config_for(:artworks)
  pp artworks
end
