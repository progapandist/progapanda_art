require "thor"
# Specify the directory path where the files are located
ART_SOURCE_DIR = "/Users/progapandist/progapanda_art_sources"
DEFAULT_CITY = "Berlin"
DEFAULT_YEAR = Time.current.year

class Seeder < Thor
  include Thor::Actions

  desc "go_seed", "Seed the database with works"
  def go_seed
    Work.destroy_all

    # Get an array of filenames from the specified directory
    slugs = Dir.entries(ART_SOURCE_DIR).select { |f| File.file?(File.join(ART_SOURCE_DIR, f)) && !f.start_with?(".") }.sort
    say "Slugs: #{slugs} ", :yellow
    infos = Rails.application.config_for(:artworks)[:artworks].map { |artwork| {artwork[:slug] => artwork} }
    say "\nParsed infos: #{infos} ", :yellow

    slugs.each do |slug|
      # Remove file extension from the filename to use as the slug
      slug_name = File.basename(slug, ".*")
      say "Processing #{slug_name}...", :green

      ActiveRecord::Base.transaction do
        work = Work.find_or_initialize_by(slug: slug_name)
        info = infos.flat_map(&:values).find { |rec| rec[:slug] == slug_name }
        if info.present?
          info[:title] = slug_name.humanize if info[:title].blank?
          work.update!(info)
          say "Done enriching #{pp slug_name} with #{pp info}", :green
        else
          work.update!(
            description: infos.flat_map(&:values).find { |rec| rec[:slug] == slug_name }.presence ||
              "A #{slug_name.humanize} model.",
            title: slug.humanize,
            location: DEFAULT_CITY,
            year: DEFAULT_YEAR
          )
        end
      end
    end
  end

  begin
    Seeder.new.go_seed
  rescue Errno::ENOENT => e
    say "Error: #{e}", :red
  end

  artworks = Rails.application.config_for(:artworks)
  pp artworks

  # Enriched from YAML shaped like this:
  #
  # - slug: bloom # automatically inferred from file name, documentation only
  #   title: bloom # Can be infered from slug
  #   # file_name: bloom.jpg # Override the file name
  #   year: 2023
  #   location: Berlin
  #   listing_price: 1000
  #   medium:
  #     - "print"
  #     - "Dibond"
  #   dimensions:
  #     - 90
  #     - 60
  #     - 0.5
  #   description: >
  #     Bloom is an interactive music generator that creates a unique
  #     audio-visual experience each time it is played.
end
