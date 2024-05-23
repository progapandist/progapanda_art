require "thor"
# Specify the directory path where the files are located
ART_SOURCE_DIR = Rails.env.production? ? Rails.root.join("art_sources") : "/Users/progapandist/progapanda_art_sources"
DEFAULT_CITY = "Berlin"
DEFAULT_YEAR = Time.current.year

class Seeder < Thor
  include Thor::Actions

  desc "go_seed", "Seed the database with works"

  def go_seed
    Work.destroy_all

    say "Checking directory: #{ART_SOURCE_DIR}", :red
    say "Directory contents:", :green
    Dir.entries(ART_SOURCE_DIR).each { |entry| say entry, :blue }

    # Get an array of filenames from the specified directory
    slugs = Dir.entries(ART_SOURCE_DIR).select { |f| File.file?(File.join(ART_SOURCE_DIR, f)) && !f.start_with?(".") }.sort
    say ART_SOURCE_DIR.to_s, :red
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
        work.update!(imgproxy_url: Imgproxy.url_for(slug_name, width: 4000, height: 3000, resizing_type: :fill, gravity: :sm))
      end
    end
  end

  Seeder.new.go_seed
  # rescue Errno::ENOENT, Errno::ENOACCES => e
  #   puts "🙏🙏🙏🙏  Error: #{e}"
end

artworks = Rails.application.config_for(:artworks)
pp artworks
